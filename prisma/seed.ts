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
import { calculateBill } from "../src/lib/billing";
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
        billPrefix: "SG",
        upiId: "spicegarden@okhdfc",
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
    let catOrder = 0;
    let itemOrder = 0;
    for (const [category, list] of MENU) {
      const cat = await prisma.menuCategory.create({ data: { restaurantId, name: category, sortOrder: ++catOrder } });
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

    // Two weeks of paid bills
    const rand = rng(42);
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
    let orderSeq = 0;
    let billSeq = 0;
    let kotSeq = 0;
    const rules = { taxMode: "gst", pricesIncludeTax: false, serviceChargePercent: 0, roundOff: true };

    async function createOrder(opts: { day: string; hour: number; minute: number; type: string; tableId: string | null; status: "settled" | "open" | "billed" | "cancelled"; staff: typeof owner }) {
      const count = 2 + Math.floor(rand() * 5);
      const lines = Array.from({ length: count }, () => {
        const d = pick(dishes.filter((x) => x.name !== "Fish Amritsari"));
        const [variant, price] = pick(d.options);
        return { menuItemId: d.id, name: d.name, variant, categoryName: d.category, foodType: d.foodType, price, quantity: 1 + Math.floor(rand() * (d.category === "Breads" ? 4 : 2)), taxRate: 5 };
      });
      const discount = rand() < 0.15 ? { type: "percent", value: pick([5, 10]) } : { type: "percent", value: 0 };
      const totals = calculateBill(lines, rules, discount);
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
          status: opts.status,
          tableId: opts.tableId,
          activeTableId: paid || opts.status === "cancelled" ? null : opts.tableId,
          guests: opts.type === "dine_in" ? 1 + Math.floor(rand() * 5) : 0,
          customerName: opts.type === "dine_in" ? null : pick(["Anita", "Vikram", "Sneha", "Arjun", "Meera"]),
          customerPhone: opts.type === "dine_in" ? null : `98${Math.floor(10000000 + rand() * 89999999)}`,
          discountType: discount.type,
          discountValue: discount.value,
          discountReason: discount.value ? "Regular customer" : null,
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
      if (paid) {
        const method = rand() < 0.55 ? "upi" : rand() < 0.7 ? "cash" : "card";
        await prisma.payment.create({ data: { restaurantId, orderId: order.id, amount: totals.total, method, receivedBy: opts.staff.name, paidAt: settledAt } });
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
    // Lunch starts at 11; before that there are no bills yet today.
    for (let i = 0; i < (nowHour > 12 ? Math.min(12, (nowHour - 11) * 2) : 0); i++) {
      const type = rand() < 0.7 ? "dine_in" : "takeaway";
      await createOrder({
        day: today,
        hour: 11 + Math.floor(rand() * (nowHour - 12)),
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

    await rawPrisma.restaurant.update({ where: { id: restaurantId }, data: { orderSeq, billSeq, kotSeq } });
    // The demo restaurant has paid its software subscription up to this month.
    for (const month of monthRange(addDays(today, -60).slice(0, 7), today.slice(0, 7))) {
      await rawPrisma.subscriptionPayment.create({ data: { restaurantId, month, amount: 999, method: "upi", paidOn: new Date(`${month}-05T00:00:00Z`) } });
    }
    await prisma.activityLog.create({ data: { restaurantId, staffId: owner.id, staffName: owner.name, action: "Demo data loaded", details: `${orderSeq} orders` } });
    console.log(`Demo restaurant created: ${tableRows.length} tables, ${dishes.length} dishes, ${orderSeq} orders.`);
  });
}

async function main() {
  if (withDemo) {
    await seedDemo();
    console.log("Sign in at /login with:");
    console.log("  Owner / manager:   owner@spicegarden.test / owner123");
    console.log("  Cashier / captain: cashier@spicegarden.test / cashier123");
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
