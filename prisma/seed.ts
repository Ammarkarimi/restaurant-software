/**
 * Seeds the database.
 *
 *   npm run db:seed        -> nothing to add: restaurants are created from the owner panel at /platform
 *   npm run db:seed:demo   -> a demo restaurant ("Spice Garden") with tables, a full menu,
 *                             two weeks of paid bills and a few running orders, for trying the software
 *
 * The demo is safe to run again: it is skipped when the demo restaurant already exists.
 */
import bcrypt from "bcryptjs";
import { currentRestaurantId, prisma, rawPrisma, runForRestaurant } from "../src/lib/db";
import { addDays, todayKey } from "../src/lib/dates";
import { calculateBill, round2 } from "../src/lib/billing";
import { usageFor } from "../src/lib/stock";
import { DEFAULT_BILL_TEMPLATE } from "../src/lib/bill-template";
import { monthRange } from "../src/lib/subscription";

const withDemo = process.argv.includes("--demo");
const TZ = "Asia/Kolkata";
const DEMO_SLUG = "spice-garden";

type Dish = [name: string, price: number | Array<[string, number]>, foodType: "veg" | "non_veg" | "egg", code?: string];

const MENU: Array<[category: string, dishes: Dish[]]> = [
  [
    "Starters",
    [
      ["Paneer Tikka", 280, "veg", "PT"],
      ["Hara Bhara Kebab", 220, "veg", "HBK"],
      ["Chicken Tikka", [["Half", 220], ["Full", 380]], "non_veg", "CT"],
      ["Chicken 65", 320, "non_veg", "C65"],
      ["Fish Amritsari", 360, "non_veg", "FA"],
      ["Egg Pakoda", 160, "egg", "EP"],
    ],
  ],
  [
    "Main course",
    [
      ["Paneer Butter Masala", 300, "veg", "PBM"],
      ["Dal Makhani", [["Half", 180], ["Full", 260]], "veg", "DM"],
      ["Kadai Veg", 260, "veg", "KV"],
      ["Butter Chicken", [["Half", 260], ["Full", 420]], "non_veg", "BC"],
      ["Mutton Rogan Josh", 480, "non_veg", "MRJ"],
      ["Egg Curry", 200, "egg", "EC"],
    ],
  ],
  [
    "Biryani & rice",
    [
      ["Veg Biryani", 240, "veg", "VB"],
      ["Chicken Biryani", [["Half", 200], ["Full", 320]], "non_veg", "CB"],
      ["Mutton Biryani", 420, "non_veg", "MB"],
      ["Jeera Rice", 160, "veg", "JR"],
      ["Steamed Rice", 120, "veg", "SR"],
    ],
  ],
  [
    "Breads",
    [
      ["Tandoori Roti", 30, "veg", "TR"],
      ["Butter Naan", 45, "veg", "BN"],
      ["Garlic Naan", 60, "veg", "GN"],
      ["Lachha Paratha", 55, "veg", "LP"],
    ],
  ],
  [
    "Beverages",
    [
      ["Masala Chaas", 60, "veg", "MC"],
      ["Sweet Lassi", 90, "veg", "SL"],
      ["Fresh Lime Soda", 80, "veg", "FLS"],
      ["Mineral Water", 30, "veg", "MW"],
      ["Masala Chai", 40, "veg", "CHAI"],
    ],
  ],
  [
    "Desserts",
    [
      ["Gulab Jamun", 90, "veg", "GJ"],
      ["Rasmalai", 120, "veg", "RM"],
      ["Kulfi Falooda", 150, "veg", "KF"],
    ],
  ],
];

/** Which kitchen station cooks each category; the rest go to the main kitchen. */
const STATIONS: Record<string, string> = { Starters: "Tandoor", Breads: "Tandoor", Beverages: "Bar" };
const RIDERS = [
  { name: "Raju", phone: "9812345670" },
  { name: "Sunil", phone: "9823456701" },
];

/** Small deterministic random generator, so the demo looks the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A moment on a given restaurant day at local time hh:mm (India is UTC+5:30). */
function at(day: string, hour: number, minute: number) {
  return new Date(new Date(`${day}T00:00:00+05:30`).getTime() + (hour * 60 + minute) * 60_000);
}

async function seedDemo() {
  const existing = await rawPrisma.restaurant.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) {
    console.log("Demo restaurant already exists, skipping.");
    return;
  }
  const today = todayKey(TZ);
  const restaurant = await rawPrisma.restaurant.create({
    data: {
      name: "Spice Garden",
      slug: DEMO_SLUG,
      city: "Pune",
      contactName: "Rohit Mehra",
      contactPhone: "9876543210",
      contactEmail: "owner@spicegarden.test",
      monthlyFee: 999,
      billingStart: addDays(today, -60).slice(0, 7),
    },
  });

  await runForRestaurant(restaurant.id, async () => {
    const restaurantId = currentRestaurantId();
    const owner = await prisma.staff.create({
      data: { restaurantId, email: "owner@spicegarden.test", passwordHash: await bcrypt.hash("owner123", 10), name: "Rohit Mehra", role: "admin" },
    });
    const cashier = await prisma.staff.create({
      data: { restaurantId, email: "cashier@spicegarden.test", passwordHash: await bcrypt.hash("cashier123", 10), name: "Ravi Kumar", role: "staff" },
    });
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        restaurantName: "Spice Garden",
        legalName: "Mehra Hospitality Pvt Ltd",
        address: "12, FC Road, Shivajinagar",
        city: "Pune 411005",
        phone: "020 2553 1234",
        email: "hello@spicegarden.test",
        gstin: "27AABCM1234F1Z5",
        fssai: "11521999000123",
        taxMode: "gst",
        defaultTaxRate: 5,
        serviceChargePercent: 0,
        roundOff: true,
        packingCharge: 20,
        deliveryCharge: 30,
        loyaltyEnabled: true,
        loyaltyEarnPercent: 5,
        loyaltyMinRedeem: 50,
        qrOrderingEnabled: true,
        billPrefix: "SG",
        upiId: "spicegarden@okhdfc",
        kitchenStations: JSON.stringify(["Tandoor", "Bar"]),
        deliveryRiders: JSON.stringify(RIDERS),
        appCommission: JSON.stringify({ zomato: 25, swiggy: 22 }),
        onlineOrderingEnabled: true,
        onlineDeliveryEnabled: true,
        onlineMinOrder: 200,
        onlineBookingEnabled: true,
        billTemplate: JSON.stringify({ ...DEFAULT_BILL_TEMPLATE, headerText: "North Indian · Tandoor · Biryani", showUpiQr: true }),
      },
    });

    // Tables
    const tables = [
      ...Array.from({ length: 10 }, (_, i) => ({ name: `T${i + 1}`, area: "Main hall", seats: i < 6 ? 4 : 6 })),
      ...Array.from({ length: 4 }, (_, i) => ({ name: `G${i + 1}`, area: "Garden", seats: 4 })),
      ...Array.from({ length: 2 }, (_, i) => ({ name: `R${i + 1}`, area: "Rooftop", seats: 8 })),
    ];
    await prisma.diningTable.createMany({ data: tables.map((t, i) => ({ ...t, restaurantId, sortOrder: i + 1 })) });
    const tableRows = await prisma.diningTable.findMany({ orderBy: { sortOrder: "asc" } });

    // Menu
    const dishes: Array<{ id: string; name: string; category: string; foodType: string; options: Array<[string | null, number]> }> = [];
    const categoryIds = new Map<string, string>();
    let catOrder = 0;
    let itemOrder = 0;
    for (const [category, list] of MENU) {
      const cat = await prisma.menuCategory.create({ data: { restaurantId, name: category, sortOrder: ++catOrder, station: STATIONS[category] ?? null } });
      categoryIds.set(category, cat.id);
      for (const [name, price, foodType, code] of list) {
        const variants = Array.isArray(price) ? price.map(([n, p]) => ({ name: n, price: p })) : [];
        const item = await prisma.menuItem.create({
          data: {
            restaurantId,
            categoryId: cat.id,
            name,
            shortCode: code ?? null,
            price: Array.isArray(price) ? Math.min(...price.map((p) => p[1])) : price,
            variants: JSON.stringify(variants),
            foodType,
            sortOrder: ++itemOrder,
            available: name !== "Fish Amritsari",
          },
        });
        dishes.push({ id: item.id, name, category, foodType, options: Array.isArray(price) ? price : [[null, price]] });
      }
    }

    // Dish descriptions for the QR / online menu
    const descriptions: Record<string, string> = {
      "Paneer Tikka": "Cottage cheese marinated in yoghurt and spices, grilled in the tandoor",
      "Chicken Tikka": "Boneless chicken, hung curd and kashmiri chilli, from the tandoor",
      "Paneer Butter Masala": "Soft paneer in a rich tomato, butter and cashew gravy",
      "Dal Makhani": "Black lentils slow cooked overnight with butter and cream",
      "Butter Chicken": "Tandoori chicken in our classic makhani gravy",
      "Chicken Biryani": "Dum-cooked basmati rice with chicken, saffron and fried onions, served with raita",
      "Mutton Biryani": "Hyderabadi style, slow cooked with tender mutton",
      "Kulfi Falooda": "Malai kulfi with falooda, rose syrup and basil seeds",
    };
    for (const [name, description] of Object.entries(descriptions)) {
      await prisma.menuItem.update({ where: { id: dishes.find((d) => d.name === name)!.id }, data: { description } });
    }

    // Add-ons offered with dishes
    const addonGroups: Array<[name: string, min: number, max: number, options: Array<[string, number]>, dishes: string[]]> = [
      ["Spice level", 1, 1, [["Mild", 0], ["Medium", 0], ["Spicy", 0]], ["Chicken 65", "Veg Biryani", "Chicken Biryani", "Mutton Biryani", "Kadai Veg"]],
      ["Extras", 0, 0, [["Extra paneer", 60], ["Butter on top", 20], ["Extra gravy", 40]], ["Paneer Butter Masala", "Kadai Veg", "Dal Makhani", "Butter Chicken"]],
      ["Add a drink", 0, 1, [["Masala Chaas", 50], ["Sweet Lassi", 80], ["Soft drink", 40]], ["Veg Biryani", "Chicken Biryani", "Mutton Biryani"]],
    ];
    const groupsFor = new Map<string, string[]>();
    for (const [i, [name, minSelect, maxSelect, options, forDishes]] of addonGroups.entries()) {
      const g = await prisma.addonGroup.create({ data: { restaurantId, name, minSelect, maxSelect, sortOrder: i + 1, options: JSON.stringify(options.map(([n, price]) => ({ name: n, price }))) } });
      for (const dish of forDishes) groupsFor.set(dish, [...(groupsFor.get(dish) ?? []), g.id]);
    }
    for (const [dish, ids] of groupsFor) {
      await prisma.menuItem.update({ where: { id: dishes.find((d) => d.name === dish)!.id }, data: { addonGroupIds: JSON.stringify(ids) } });
    }

    // Special prices: the apps charge more, the rooftop a little more, and drinks are cheaper on weekday evenings.
    await prisma.priceList.createMany({
      data: [
        { restaurantId, name: "Zomato & Swiggy prices", adjustPercent: 15, roundTo: 5, sources: JSON.stringify(["zomato", "swiggy"]), sortOrder: 1 },
        { restaurantId, name: "Rooftop", adjustPercent: 10, roundTo: 5, areas: JSON.stringify(["Rooftop"]), orderTypes: JSON.stringify(["dine_in"]), sortOrder: 2 },
        { restaurantId, name: "Happy hours: drinks 20% off", adjustPercent: -20, roundTo: 5, days: JSON.stringify([1, 2, 3, 4, 5]), startTime: "16:00", endTime: "19:00", categoryIds: JSON.stringify([categoryIds.get("Beverages")]), sortOrder: 3 },
      ],
    });

    // Offers and coupon codes
    const bigBillOffer = await prisma.offer.create({ data: { restaurantId, name: "10% off above ₹1000", type: "percent", value: 10, maxDiscount: 200, minBill: 1000 } });
    await prisma.offer.create({ data: { restaurantId, name: "Welcome offer", code: "WELCOME50", type: "amount", value: 50, minBill: 300, timesUsed: 6 } });
    await prisma.offer.create({ data: { restaurantId, name: "Weekday lunch 15% off", type: "percent", value: 15, maxDiscount: 150, orderTypes: JSON.stringify(["dine_in"]), days: JSON.stringify([1, 2, 3, 4, 5]), startTime: "12:00", endTime: "15:30", timesUsed: 9 } });

    // Two weeks of paid bills
    const rand = rng(42);
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
    let orderSeq = 0;
    let billSeq = 0;
    let kotSeq = 0;
    const rules = { taxMode: "gst", pricesIncludeTax: false, serviceChargePercent: 0, roundOff: true };

    // Regular guests, so the customer list and loyalty points have history.
    const regulars = [
      ["Anita Desai", "9822011223"], ["Vikram Joshi", "9823344556"], ["Sneha Kulkarni", "9890011122"], ["Arjun Nair", "9765432109"],
      ["Meera Iyer", "9811122233"], ["Rahul Patil", "9850098765"], ["Pooja Shah", "9767788990"], ["Karan Mehta", "9881234567"],
      ["Neha Gupta", "9922113344"], ["Amit Deshpande", "9960011223"], ["Divya Rao", "9545566778"], ["Sameer Khan", "9673344221"],
    ];
    const customerIds = new Map<string, string>();
    const soldItems = new Map<string, Array<{ menuItemId: string | null; variant: string | null; quantity: number }>>();

    async function createOrder(opts: { day: string; hour: number; minute: number; type: string; tableId: string | null; status: "settled" | "open" | "billed" | "cancelled"; staff: typeof owner; source?: string }) {
      // Takeaway and delivery come from the counter, phone or the apps; the apps already charge packing.
      const source = opts.source ?? (opts.type === "dine_in" ? "counter" : pick(["counter", "phone", "zomato", "zomato", "swiggy", "swiggy"]));
      const fromApp = source === "zomato" || source === "swiggy";
      const count = 2 + Math.floor(rand() * 5);
      const lines = Array.from({ length: count }, () => {
        const d = pick(dishes.filter((x) => x.name !== "Fish Amritsari"));
        const [variant, base] = pick(d.options);
        // Dishes on Zomato / Swiggy cost 15% more (the price list above).
        let price = fromApp ? Math.round((base * 1.15) / 5) * 5 : base;
        const addons: Array<{ group: string; name: string; price: number }> = [];
        if (d.name.includes("Biryani") || d.name === "Chicken 65") addons.push({ group: "Spice level", name: pick(["Mild", "Medium", "Medium", "Spicy"]), price: 0 });
        if (d.name.includes("Biryani") && rand() < 0.3) addons.push({ group: "Add a drink", name: "Masala Chaas", price: 50 });
        if (["Paneer Butter Masala", "Butter Chicken"].includes(d.name) && rand() < 0.25) addons.push({ group: "Extras", name: "Butter on top", price: 20 });
        price += addons.reduce((s, a) => s + a.price, 0);
        return {
          menuItemId: d.id,
          name: d.name,
          variant,
          categoryName: d.category,
          foodType: d.foodType,
          price,
          quantity: 1 + Math.floor(rand() * (d.category === "Breads" ? 4 : 2)),
          taxRate: 5,
          addons: JSON.stringify(addons),
          station: STATIONS[d.category] ?? null,
        };
      });
      const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
      // Now and then a bill is on the house (the owner's guest).
      const complimentary = opts.type === "dine_in" && opts.status === "settled" && rand() < 0.012;
      const offer = !complimentary && itemsTotal >= 1000 && rand() < 0.25;
      const discount: { type: string; value: number; max?: number | null } = complimentary
        ? { type: "percent", value: 100 }
        : offer
          ? { type: "percent", value: 10, max: 200 }
          : rand() < 0.12
            ? { type: "percent", value: pick([5, 10]) }
            : { type: "percent", value: 0 };
      const packingCharge = opts.type !== "dine_in" && !fromApp && !complimentary ? 20 : 0;
      const deliveryCharge = opts.type === "delivery" && !fromApp ? 30 : 0;
      const regular = opts.type !== "dine_in" || rand() < 0.3 ? (fromApp ? null : pick(regulars)) : null;
      const rider = opts.type === "delivery" && !fromApp ? pick(RIDERS).name : null;
      const charges = [
        { name: "Packing charge", amount: packingCharge, taxRate: 5 },
        { name: "Delivery charge", amount: deliveryCharge, taxRate: 5 },
      ];
      const totals = calculateBill(lines, rules, discount, { charges });
      const createdAt = at(opts.day, opts.hour, opts.minute);
      const settledAt = new Date(createdAt.getTime() + (35 + Math.floor(rand() * 40)) * 60_000);
      const kot = ++kotSeq;
      const paid = opts.status === "settled";
      const billed = paid || opts.status === "billed";
      const order = await prisma.order.create({
        data: {
          restaurantId,
          number: ++orderSeq,
          type: opts.type,
          source,
          sourceRef: fromApp ? String(Math.floor(100000 + rand() * 899999)) : null,
          status: opts.status,
          tableId: opts.tableId,
          activeTableId: paid || opts.status === "cancelled" ? null : opts.tableId,
          guests: opts.type === "dine_in" ? 1 + Math.floor(rand() * 5) : 0,
          customerName: regular ? regular[0] : fromApp ? pick(["Aditi", "Rohan", "Ishaan", "Kavya"]) : null,
          customerPhone: regular ? regular[1] : null,
          packingCharge,
          deliveryCharge,
          chargeTaxRate: 5,
          chargesAmount: totals.chargesTotal,
          discountType: discount.type,
          discountValue: discount.value,
          discountMax: discount.max ?? null,
          discountReason: complimentary ? "Complimentary: Owner's guest" : offer ? bigBillOffer.name : discount.value ? "Regular customer" : null,
          offerId: offer ? bigBillOffer.id : null,
          complimentary,
          riderName: rider,
          deliveryStatus: rider && paid ? "delivered" : null,
          outAt: rider && paid ? new Date(createdAt.getTime() + 15 * 60_000) : null,
          deliveredAt: rider && paid ? new Date(settledAt.getTime() - 3 * 60_000) : null,
          taxMode: "gst",
          roundOff: true,
          billNumber: billed ? `SG${++billSeq}` : null,
          subtotal: totals.itemsTotal,
          discountAmount: totals.discount,
          taxAmount: totals.tax,
          roundOffAmount: totals.roundOff,
          total: totals.total,
          businessDate: paid || opts.status === "cancelled" ? opts.day : null,
          cancelReason: opts.status === "cancelled" ? "Guest left before food was served" : null,
          cancelledAt: opts.status === "cancelled" ? settledAt : null,
          createdById: opts.staff.id,
          createdByName: opts.staff.name,
          createdAt,
          billedAt: billed ? settledAt : null,
          settledAt: paid ? settledAt : null,
          items: { create: lines.map((l) => ({ ...l, restaurantId, kotNumber: kot, sentAt: new Date(createdAt.getTime() + 2 * 60_000), createdAt })) },
        },
      });
      if (offer && paid) await prisma.offer.update({ where: { id: bigBillOffer.id }, data: { timesUsed: { increment: 1 } } });
      if (paid) soldItems.set(opts.day, [...(soldItems.get(opts.day) ?? []), ...lines]);
      if (paid && !complimentary) {
        const method = fromApp ? "online" : rider ? "cash" : rand() < 0.55 ? "upi" : rand() < 0.7 ? "cash" : "card";
        await prisma.payment.create({ data: { restaurantId, orderId: order.id, amount: totals.total, method, receivedBy: opts.staff.name, paidAt: settledAt } });
        if (regular) {
          const earned = Math.floor(totals.total * 0.05);
          const id = customerIds.get(regular[1]);
          const customer = id
            ? await prisma.customer.update({ where: { id }, data: { visits: { increment: 1 }, totalSpent: { increment: totals.total }, points: { increment: earned }, lastVisitAt: settledAt } })
            : await prisma.customer.create({ data: { restaurantId, phone: regular[1], name: regular[0], visits: 1, totalSpent: totals.total, points: earned, lastVisitAt: settledAt, createdAt: settledAt } });
          customerIds.set(regular[1], customer.id);
          await prisma.order.update({ where: { id: order.id }, data: { customerId: customer.id, pointsEarned: earned } });
        }
      }
      return order;
    }

    for (let back = 14; back >= 1; back--) {
      const day = addDays(today, -back);
      const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
      const bills = (weekend ? 26 : 16) + Math.floor(rand() * 8);
      for (let i = 0; i < bills; i++) {
        const lunch = rand() < 0.4;
        const hour = lunch ? 12 + Math.floor(rand() * 3) : 19 + Math.floor(rand() * 4);
        const type = rand() < 0.7 ? "dine_in" : rand() < 0.6 ? "takeaway" : "delivery";
        await createOrder({
          day,
          hour,
          minute: Math.floor(rand() * 60),
          type,
          tableId: type === "dine_in" ? pick(tableRows).id : null,
          status: rand() < 0.03 ? "cancelled" : "settled",
          staff: rand() < 0.7 ? cashier : owner,
        });
      }
    }

    // Earlier today: some paid bills, so "Sales today" has numbers.
    const nowHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).format(new Date())) % 24;
    // The restaurant opens at 8 for breakfast; before that there are no bills yet today.
    for (let i = 0; i < (nowHour > 8 ? Math.min(14, (nowHour - 8) * 3) : 0); i++) {
      const type = rand() < 0.7 ? "dine_in" : "takeaway";
      await createOrder({
        day: today,
        hour: 8 + Math.floor(rand() * (nowHour - 8)),
        minute: Math.floor(rand() * 60),
        type,
        tableId: type === "dine_in" ? pick(tableRows).id : null,
        status: "settled",
        staff: cashier,
      });
    }

    // Right now: a few running orders, one waiting for payment.
    const startHour = Math.max(0, nowHour - 1);
    await createOrder({ day: today, hour: startHour, minute: 5, type: "dine_in", tableId: tableRows[1].id, status: "open", staff: cashier });
    await createOrder({ day: today, hour: startHour, minute: 20, type: "dine_in", tableId: tableRows[4].id, status: "billed", staff: cashier });
    await createOrder({ day: today, hour: startHour, minute: 30, type: "dine_in", tableId: tableRows[10].id, status: "open", staff: owner });
    await createOrder({ day: today, hour: startHour, minute: 40, type: "takeaway", tableId: null, status: "open", staff: cashier });

    // The kitchen marked the first running table's dishes ready; a guest ordered and called a waiter from the T7 QR code.
    await prisma.orderItem.updateMany({ where: { order: { activeTableId: tableRows[1].id } }, data: { kitchenStatus: "ready", readyAt: new Date() } });
    const qrTable = tableRows[6];
    const guestOrder = await prisma.order.create({
      data: {
        restaurantId,
        number: ++orderSeq,
        type: "dine_in",
        source: "qr",
        tableId: qrTable.id,
        activeTableId: qrTable.id,
        customerName: "Farhan",
        createdByName: `Guest at ${qrTable.name} (Farhan)`,
        taxMode: "gst",
        chargeTaxRate: 5,
        items: {
          create: [dishes[0], dishes[12]].map((d) => ({ restaurantId, menuItemId: d.id, name: d.name, variant: d.options[0][0], categoryName: d.category, foodType: d.foodType, price: d.options[0][1], quantity: 1, taxRate: 5, byGuest: true })),
        },
      },
      include: { items: true },
    });
    await prisma.order.update({ where: { id: guestOrder.id }, data: { subtotal: guestOrder.items.reduce((s, i) => s + i.price, 0) } });
    await prisma.diningTable.update({ where: { id: qrTable.id }, data: { callType: "waiter", callAt: new Date(Date.now() - 2 * 60_000) } });

    // A delivery on its way with a rider.
    const outForDelivery = await createOrder({ day: today, hour: startHour, minute: 10, type: "delivery", tableId: null, status: "billed", staff: cashier, source: "phone" });
    await prisma.order.update({
      where: { id: outForDelivery.id },
      data: { customerName: "Sneha Kulkarni", customerPhone: "9890011122", customerAddress: "Flat 4B, Sai Residency, Model Colony, Pune", riderName: RIDERS[0].name, deliveryStatus: "out", outAt: new Date(Date.now() - 12 * 60_000) },
    });
    await prisma.orderItem.updateMany({ where: { orderId: outForDelivery.id }, data: { kitchenStatus: "served", readyAt: new Date(Date.now() - 15 * 60_000) } });

    // A guest ordered takeaway from the restaurant's own online ordering link; staff accept it by sending it to the kitchen.
    const byName = (name: string) => dishes.find((d) => d.name === name)!;
    const onlineLines = [
      { dish: byName("Chicken Biryani"), variant: "Full", price: 320 + 80, quantity: 1, addons: [{ group: "Spice level", name: "Spicy", price: 0 }, { group: "Add a drink", name: "Sweet Lassi", price: 80 }] },
      { dish: byName("Paneer Butter Masala"), variant: null, price: 300, quantity: 1, addons: [] },
      { dish: byName("Butter Naan"), variant: null, price: 45, quantity: 3, addons: [] },
    ];
    const onlineTotals = calculateBill(onlineLines.map((l) => ({ price: l.price, quantity: l.quantity, taxRate: 5 })), rules, null, { charges: [{ name: "Packing charge", amount: 20, taxRate: 5 }] });
    await prisma.order.create({
      data: {
        restaurantId,
        number: ++orderSeq,
        type: "takeaway",
        source: "website",
        customerName: "Priya Sharma",
        customerPhone: "9812300456",
        scheduledFor: new Date(Math.ceil((Date.now() + 40 * 60_000) / (15 * 60_000)) * 15 * 60_000),
        createdByName: "Online: Priya Sharma",
        taxMode: "gst",
        chargeTaxRate: 5,
        packingCharge: 20,
        chargesAmount: onlineTotals.chargesTotal,
        subtotal: onlineTotals.itemsTotal,
        taxAmount: onlineTotals.tax,
        roundOffAmount: onlineTotals.roundOff,
        total: onlineTotals.total,
        createdAt: new Date(Date.now() - 4 * 60_000),
        items: {
          create: onlineLines.map((l) => ({
            restaurantId,
            menuItemId: l.dish.id,
            name: l.dish.name,
            variant: l.variant,
            categoryName: l.dish.category,
            foodType: l.dish.foodType,
            price: l.price,
            quantity: l.quantity,
            taxRate: 5,
            addons: JSON.stringify(l.addons),
            station: STATIONS[l.dish.category] ?? null,
            byGuest: true,
          })),
        },
      },
    });

    // Customer accounts: two regulars eat now and pay later, one keeps money with the restaurant.
    const putOnAccount = async (phone: string, bills: number, creditLimit: number | null) => {
      const customerId = customerIds.get(phone);
      if (!customerId) return;
      const recent = await prisma.order.findMany({ where: { customerId, status: "settled", complimentary: false, businessDate: { lt: today } }, orderBy: { settledAt: "desc" }, take: bills });
      let balance = 0;
      for (const o of recent.reverse()) {
        await prisma.payment.updateMany({ where: { orderId: o.id }, data: { method: "account" } });
        balance = round2(balance - o.total);
        await prisma.customerTxn.create({ data: { restaurantId, customerId, type: "bill", amount: -o.total, balance, orderId: o.id, billNumber: o.billNumber, date: o.businessDate!, createdByName: o.createdByName ?? owner.name, createdAt: o.settledAt! } });
      }
      await prisma.customer.update({ where: { id: customerId }, data: { balance, creditLimit } });
    };
    await putOnAccount("9823344556", 3, 5000); // Vikram Joshi
    await putOnAccount("9850098765", 1, null); // Rahul Patil
    // Vikram paid part of his dues in cash this morning.
    const vikram = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone: "9823344556" } } });
    if (vikram && vikram.balance < -500) {
      const after = round2(vikram.balance + 500);
      await prisma.customerTxn.create({ data: { restaurantId, customerId: vikram.id, type: "received", amount: 500, balance: after, method: "cash", note: "Part payment", date: today, createdByName: cashier.name } });
      await prisma.customer.update({ where: { id: vikram.id }, data: { balance: after } });
    }
    const meera = customerIds.get("9811122233");
    if (meera) {
      await prisma.customerTxn.create({ data: { restaurantId, customerId: meera, type: "received", amount: 2000, balance: 2000, method: "upi", note: "Advance for the month", date: addDays(today, -5), createdByName: owner.name, createdAt: at(addDays(today, -5), 13, 10) } });
      await prisma.customer.update({ where: { id: meera }, data: { balance: 2000 } });
    }
    // Birthdays: two this week, for the birthday WhatsApp offer.
    const birthdays: Array<[string, string]> = [
      ["9822011223", `1988-${addDays(today, 2).slice(5)}`],
      ["9881234567", `1992-${addDays(today, 5).slice(5)}`],
      ["9890011122", "1995-02-14"],
      ["9765432109", "1985-11-30"],
    ];
    for (const [phone, birthday] of birthdays) {
      const id = customerIds.get(phone);
      if (id) await prisma.customer.update({ where: { id }, data: { birthday } });
    }

    // Guest ratings from the bill link
    const comments5 = ["Loved the butter chicken!", "Great food and quick service", "Biryani was perfect, will come again", null, null, "Best paneer tikka in Pune"];
    const comments4 = ["Good food, a bit crowded on the weekend", null, "Naan could be softer", null];
    const rated = await prisma.order.findMany({ where: { status: "settled", customerId: { not: null }, businessDate: { lt: today } }, orderBy: { settledAt: "asc" }, select: { id: true, customerId: true, customerName: true, customerPhone: true, settledAt: true } });
    for (const [i, o] of rated.entries()) {
      if (i % 3 !== 0) continue;
      const roll = rand();
      const rating = roll < 0.55 ? 5 : roll < 0.85 ? 4 : roll < 0.93 ? 3 : 2;
      const low = rating <= 2;
      await prisma.feedback.create({
        data: {
          restaurantId,
          orderId: o.id,
          customerId: o.customerId,
          name: o.customerName,
          phone: o.customerPhone,
          rating,
          food: Math.min(5, rating + (rand() < 0.3 ? 1 : 0)),
          service: low ? 1 : rating,
          ambience: Math.max(3, rating),
          comment: low ? "Waited 40 minutes for our main course and nobody told us why." : rating === 5 ? pick(comments5) : rating === 4 ? pick(comments4) : "Food was okay, service was slow",
          followedUp: false,
          createdAt: new Date(o.settledAt!.getTime() + 50 * 60_000),
        },
      });
    }

    // Table bookings: tonight, a request from the booking link to confirm, tomorrow, and yesterday's.
    const tonight = Math.min(22, Math.max(19, nowHour + 1));
    const bookings: Array<{ name: string; phone: string; guests: number; date: string; time: string; table?: string; status: string; source: string; occasion?: string; notes?: string }> = [
      { name: "Anita Desai", phone: "9822011223", guests: 2, date: today, time: `${tonight}:00`, table: "R1", status: "booked", source: "phone", occasion: "Anniversary", notes: "Corner seat, cake at 9" },
      { name: "Kunal Bhosale", phone: "9890123456", guests: 6, date: today, time: `${tonight}:30`, table: "T8", status: "booked", source: "phone" },
      { name: "Shreya Menon", phone: "9765012345", guests: 4, date: today, time: `${Math.min(23, tonight + 1)}:00`, status: "requested", source: "online", notes: "Need a high chair for a baby" },
      { name: "Arjun Nair", phone: "9765432109", guests: 4, date: addDays(today, 1), time: "13:00", table: "G1", status: "booked", source: "phone" },
      { name: "Karan Mehta", phone: "9881234567", guests: 8, date: addDays(today, 1), time: "20:00", table: "R2", status: "booked", source: "online", occasion: "Birthday" },
      { name: "Pooja Shah", phone: "9767788990", guests: 3, date: addDays(today, -1), time: "20:00", table: "G2", status: "seated", source: "phone" },
      { name: "Nikhil Rane", phone: "9850111222", guests: 2, date: addDays(today, -1), time: "21:00", status: "no_show", source: "phone" },
    ];
    for (const b of bookings) {
      await prisma.reservation.create({
        data: {
          restaurantId,
          name: b.name,
          phone: b.phone,
          guests: b.guests,
          date: b.date,
          time: b.time,
          tableId: b.table ? tableRows.find((t) => t.name === b.table)!.id : null,
          status: b.status,
          source: b.source,
          occasion: b.occasion ?? null,
          notes: b.notes ?? null,
          createdByName: b.source === "online" ? "Booking link" : cashier.name,
          createdAt: at(b.date < today ? b.date : today, 11, 15),
        },
      });
    }

    // Expenses and closed days
    const expenseKinds: Array<[string, number, string | null]> = [
      ["Vegetables & fruit", 1800, "Ramesh Sabziwala"],
      ["Dairy", 1200, "Amul parlour"],
      ["Meat & fish", 2500, "Fresh Meat Mart"],
      ["Gas / fuel", 950, null],
      ["Cleaning", 300, null],
      ["Staff salary / advance", 2000, "Ravi (advance)"],
    ];
    let cashLeft = 2000;
    for (let back = 14; back >= 1; back--) {
      const day = addDays(today, -back);
      const todays = expenseKinds.filter((_, i) => i < 3 || rand() < 0.3);
      for (const [category, base, paidTo] of todays) {
        await prisma.expense.create({
          data: { restaurantId, date: day, category, amount: Math.round(base * (0.7 + rand() * 0.6)), method: rand() < 0.75 ? "cash" : "upi", paidTo, createdById: owner.id, createdByName: owner.name, createdAt: at(day, 10, Math.floor(rand() * 50)) },
        });
      }
      const payments = await prisma.payment.findMany({ where: { order: { status: "settled", businessDate: day } } });
      const expenses = await prisma.expense.findMany({ where: { date: day } });
      const cashSales = round2(payments.filter((x) => x.method === "cash").reduce((s, x) => s + x.amount, 0));
      const cashExpenses = round2(expenses.filter((x) => x.method === "cash").reduce((s, x) => s + x.amount, 0));
      const expectedCash = round2(cashLeft + cashSales - cashExpenses);
      const countedCash = rand() < 0.75 ? expectedCash : round2(expectedCash - pick([50, 100, 20, -10]));
      const byMethod = new Map<string, { method: string; amount: number; count: number }>();
      for (const x of payments) {
        const m = byMethod.get(x.method) ?? { method: x.method, amount: 0, count: 0 };
        m.amount = round2(m.amount + x.amount);
        m.count += 1;
        byMethod.set(x.method, m);
      }
      const settledToday = await prisma.order.findMany({ where: { status: "settled", businessDate: day }, select: { total: true, discountAmount: true, taxAmount: true } });
      await prisma.dayClose.create({
        data: {
          restaurantId,
          date: day,
          openingCash: cashLeft,
          cashSales,
          cashExpenses,
          expectedCash,
          countedCash,
          difference: round2(countedCash - expectedCash),
          cashLeft: 2000,
          sales: round2(settledToday.reduce((s, o) => s + o.total, 0)),
          bills: settledToday.length,
          summary: JSON.stringify({ payments: [...byMethod.values()], expenses: [], discount: 0, tax: 0, cancelled: 0 }),
          closedById: owner.id,
          closedByName: owner.name,
          closedAt: at(day, 23, 45),
        },
      });
      cashLeft = 2000;
    }

    // Stock and recipes: opening stock two weeks ago, purchases, and what the paid bills used each day.
    const stockList: Array<[name: string, unit: string, cost: number, opening: number, lowAt: number]> = [
      ["Paneer", "kg", 320, 12, 3],
      ["Chicken", "kg", 240, 20, 5],
      ["Mutton", "kg", 650, 8, 2],
      ["Basmati rice", "kg", 110, 40, 10],
      ["Butter", "kg", 520, 6, 1.5],
      ["Cream", "L", 220, 6, 1.5],
      ["Cooking oil", "L", 145, 30, 8],
      ["Milk", "L", 60, 15, 4],
      ["Atta (wheat flour)", "kg", 42, 40, 10],
      ["Maida", "kg", 45, 25, 6],
    ];
    const stockIds = new Map<string, string>();
    for (const [name, unit, costPerUnit, , lowAt] of stockList) {
      const item = await prisma.stockItem.create({ data: { restaurantId, name, unit, costPerUnit, lowAt } });
      stockIds.set(name, item.id);
    }
    const recipeFor: Array<[dish: string, variant: string | null, stock: string, qty: number]> = [
      ["Paneer Tikka", null, "Paneer", 0.2],
      ["Paneer Butter Masala", null, "Paneer", 0.18],
      ["Paneer Butter Masala", null, "Butter", 0.02],
      ["Paneer Butter Masala", null, "Cream", 0.03],
      ["Chicken Tikka", "Half", "Chicken", 0.25],
      ["Chicken Tikka", "Full", "Chicken", 0.5],
      ["Chicken 65", null, "Chicken", 0.3],
      ["Butter Chicken", "Half", "Chicken", 0.2],
      ["Butter Chicken", "Full", "Chicken", 0.4],
      ["Butter Chicken", null, "Butter", 0.03],
      ["Butter Chicken", null, "Cream", 0.04],
      ["Mutton Rogan Josh", null, "Mutton", 0.3],
      ["Mutton Biryani", null, "Mutton", 0.25],
      ["Mutton Biryani", null, "Basmati rice", 0.15],
      ["Chicken Biryani", "Half", "Chicken", 0.15],
      ["Chicken Biryani", "Full", "Chicken", 0.3],
      ["Chicken Biryani", null, "Basmati rice", 0.15],
      ["Veg Biryani", null, "Basmati rice", 0.15],
      ["Jeera Rice", null, "Basmati rice", 0.12],
      ["Steamed Rice", null, "Basmati rice", 0.12],
      ["Butter Naan", null, "Maida", 0.08],
      ["Butter Naan", null, "Butter", 0.01],
      ["Garlic Naan", null, "Maida", 0.08],
      ["Tandoori Roti", null, "Atta (wheat flour)", 0.07],
      ["Lachha Paratha", null, "Atta (wheat flour)", 0.09],
      ["Masala Chai", null, "Milk", 0.12],
      ["Sweet Lassi", null, "Milk", 0.25],
    ];
    const recipe = [];
    for (const [dish, variant, stock, quantity] of recipeFor) {
      const d = dishes.find((x) => x.name === dish)!;
      recipe.push(await prisma.recipeLine.create({ data: { restaurantId, menuItemId: d.id, variant, stockItemId: stockIds.get(stock)!, quantity } }));
    }
    const balance = new Map<string, number>();
    const entry = async (stockItemId: string, type: string, quantity: number, date: string, extra: { cost?: number; supplier?: string; note?: string } = {}) => {
      const next = Math.round(((balance.get(stockItemId) ?? 0) + quantity) * 1000) / 1000;
      balance.set(stockItemId, next);
      await prisma.stockEntry.create({ data: { restaurantId, stockItemId, type, quantity: Math.round(quantity * 1000) / 1000, balance: next, date, createdByName: owner.name, createdAt: at(date, 9, 30), ...extra } });
    };
    const start = addDays(today, -15);
    for (const [name, , , opening] of stockList) await entry(stockIds.get(name)!, "count", opening, start, { note: "Opening stock" });
    for (let back = 14; back >= 0; back--) {
      const day = addDays(today, -back);
      // Buy back up to the opening level every few days, except a couple of items left running low today.
      if (back % 3 === 0 && back > 0) {
        for (const [name, , costPerUnit, opening] of stockList) {
          const id = stockIds.get(name)!;
          const need = Math.round((opening - (balance.get(id) ?? 0)) * 10) / 10;
          if (need > 0) await entry(id, "purchase", need, day, { cost: Math.round(need * costPerUnit), supplier: name === "Paneer" || name === "Milk" ? "Amul Dairy" : "Metro Cash & Carry" });
        }
      }
      for (const [stockItemId, quantity] of usageFor(soldItems.get(day) ?? [], recipe)) await entry(stockItemId, "used", -quantity, day, { note: `Bills of ${day}` });
    }
    await entry(stockIds.get("Cream")!, "wastage", -0.5, today, { note: "Spoiled" });

    // Suppliers and purchase orders: one received yesterday (part paid), one sent today and waiting for delivery.
    const suppliers = new Map<string, string>();
    for (const sup of [
      { name: "Metro Cash & Carry", phone: "02066778899", gstin: "27AAACM5678K1Z3", address: "Wakad, Pune" },
      { name: "Amul Dairy", phone: "9822000111" },
      { name: "Fresh Meat Mart", phone: "9822000333" },
      { name: "Ramesh Sabziwala", phone: "9822000444", notes: "Comes every morning at 9" },
    ]) {
      suppliers.set(sup.name, (await prisma.supplier.create({ data: { restaurantId, ...sup } })).id);
    }
    const poLines = (list: Array<[stock: string, quantity: number]>) =>
      list.map(([name, quantity]) => {
        const s = stockList.find((x) => x[0] === name)!;
        return { stockItemId: stockIds.get(name)!, name, unit: s[1], quantity, rate: s[2] };
      });
    const yesterday = addDays(today, -1);
    const received = poLines([["Basmati rice", 25], ["Cooking oil", 15]]);
    const receivedTotal = round2(received.reduce((s, l) => s + l.quantity * l.rate, 0));
    await prisma.purchase.create({
      data: { restaurantId, number: 1, supplierId: suppliers.get("Metro Cash & Carry"), supplierName: "Metro Cash & Carry", status: "received", invoiceNo: "MCC/2291", orderedOn: addDays(today, -3), receivedOn: yesterday, lines: JSON.stringify(received), total: receivedTotal, createdByName: owner.name, createdAt: at(addDays(today, -3), 11, 0) },
    });
    for (const l of received) await entry(l.stockItemId, "purchase", l.quantity, yesterday, { cost: round2(l.quantity * l.rate), supplier: "Metro Cash & Carry", note: "Purchase #1, bill MCC/2291" });
    await prisma.expense.create({
      data: { restaurantId, date: yesterday, category: "Supplier payment", amount: 2000, method: "bank", paidTo: "Metro Cash & Carry", notes: "Purchase #1, bill MCC/2291", supplierId: suppliers.get("Metro Cash & Carry"), createdById: owner.id, createdByName: owner.name, createdAt: at(yesterday, 16, 0) },
    });
    await prisma.supplier.update({ where: { id: suppliers.get("Metro Cash & Carry") }, data: { balance: round2(receivedTotal - 2000) } });
    const ordered = poLines([["Paneer", 5], ["Milk", 20], ["Butter", 2]]);
    await prisma.purchase.create({
      data: { restaurantId, number: 2, supplierId: suppliers.get("Amul Dairy"), supplierName: "Amul Dairy", status: "ordered", orderedOn: today, lines: JSON.stringify(ordered), total: round2(ordered.reduce((s, l) => s + l.quantity * l.rate, 0)), notes: "Deliver before 11 am", createdByName: owner.name },
    });
    for (const [id, quantity] of balance) await prisma.stockItem.update({ where: { id }, data: { quantity } });

    await rawPrisma.restaurant.update({ where: { id: restaurantId }, data: { orderSeq, billSeq, kotSeq, purchaseSeq: 2 } });
    // The demo restaurant has paid its software subscription up to this month.
    for (const month of monthRange(addDays(today, -60).slice(0, 7), today.slice(0, 7))) {
      await rawPrisma.subscriptionPayment.create({ data: { restaurantId, month, amount: 999, method: "upi", paidOn: new Date(`${month}-05T00:00:00Z`) } });
    }
    await prisma.activityLog.create({ data: { restaurantId, staffId: owner.id, staffName: owner.name, action: "Demo data loaded", details: `${orderSeq} orders` } });
    await prisma.staff.create({
      data: { restaurantId, email: "kitchen@spicegarden.test", passwordHash: await bcrypt.hash("kitchen123", 10), name: "Kitchen Tablet", role: "kitchen" },
    });
    // A captain with fewer rights: up to 10% discount, cannot remove dishes, reprint bills or see sales.
    const captain = await prisma.staff.create({
      data: {
        restaurantId,
        email: "captain@spicegarden.test",
        passwordHash: await bcrypt.hash("captain123", 10),
        name: "Suresh Pawar",
        role: "staff",
        permissions: JSON.stringify({ discountMax: 10, cancelItems: false, reprint: false, seeSales: false, expenses: false }),
      },
    });

    // Staff shifts: the cashier works days, the captain evenings (one day off).
    for (let back = 6; back >= 0; back--) {
      const day = addDays(today, -back);
      const shifts: Array<[typeof owner, number, number, number, number]> = [[cashier, 10, 50 + Math.floor(rand() * 15), 23, Math.floor(rand() * 25)]];
      if (back !== 3) shifts.push([captain, 16, 50 + Math.floor(rand() * 20), 23, 30 + Math.floor(rand() * 20)]);
      for (const [who, inH, inM, outH, outM] of shifts) {
        const inAt = at(day, inH, inM);
        if (back === 0 && inAt.getTime() > Date.now()) continue;
        await prisma.attendance.create({ data: { restaurantId, staffId: who.id, staffName: who.name, date: day, inAt, outAt: back === 0 ? null : at(day, outH, outM) } });
      }
    }

    // A WhatsApp offer sent two days ago, part way through.
    const everyone = await prisma.customer.findMany({ orderBy: { lastVisitAt: "desc" }, select: { id: true, name: true, phone: true, points: true, balance: true } });
    const sentOn = new Date(Date.now() - 2 * 24 * 3600_000);
    await prisma.campaign.create({
      data: {
        restaurantId,
        name: "Weekend special",
        segment: "all",
        message: "Hello {name}! This weekend: our chef's special thali at a special price. Book a table or order now!",
        recipients: JSON.stringify(everyone.map((c, i) => ({ customerId: c.id, name: c.name, phone: c.phone, points: c.points, balance: c.balance, sentAt: i < 8 ? new Date(sentOn.getTime() + i * 40_000).toISOString() : null }))),
        createdByName: owner.name,
        createdAt: sentOn,
      },
    });
    console.log(`Demo restaurant created: ${tableRows.length} tables, ${dishes.length} dishes, ${orderSeq} orders, ${customerIds.size} regular customers, ${stockList.length} stock items.`);
  });
}

async function main() {
  if (withDemo) {
    await seedDemo();
    console.log("Sign in at /login with:");
    console.log("  Owner / manager:   owner@spicegarden.test / owner123");
    console.log("  Cashier / captain: cashier@spicegarden.test / cashier123");
    console.log("  Kitchen screen:    kitchen@spicegarden.test / kitchen123");
    console.log("  Captain (limited): captain@spicegarden.test / captain123");
  } else {
    console.log("Nothing to seed. Create restaurants and their owner sign-ins from the owner panel at /platform.");
  }
  if (!process.env.PLATFORM_ADMIN_EMAIL || !process.env.PLATFORM_ADMIN_PASSWORD) {
    console.log("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (10+ characters) to open the owner panel at /platform.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
