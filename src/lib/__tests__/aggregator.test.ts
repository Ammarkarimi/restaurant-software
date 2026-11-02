import { test } from "node:test";
import assert from "node:assert/strict";
import { isOrderRelay, parseUrbanPiperOrder } from "../aggregator";

const relay = {
  customer: { name: "Asha", phone: "9999999999", address: { line_1: "Flat 4", sub_locality: "HSR Layout", city: "Bengaluru", pin: "560102" } },
  order: {
    details: {
      id: 3444567,
      channel: "zomato",
      order_type: "delivery",
      instructions: "Make it spicy",
      discount: 100,
      total_external_discount: 20,
      payable_amount: 625.25,
      charges: [{ title: "Restaurant Packaging Charges", value: 10 }, { title: "Delivery Charge", value: 10 }],
      ext_platforms: [{ id: "1218004251", name: "zomato", extras: { order_otp: "9337", cash_to_be_collected: 0, deliver_asap: true }, discounts: [{ is_merchant_discount: true, value: 80 }, { is_merchant_discount: false, value: 20 }] }],
    },
    items: [
      { title: "Margherita Pizza", merchant_ref_id: "m1", price: 0, quantity: 1, total: 300, food_type: "1", instructions: "extra spicy", options_to_add: [{ title: "Small", price: 200, quantity: 1, group: { title: "Choose Size" } }, { title: "Cheese", price: 50, quantity: 2 }] },
      { title: "Chicken Biryani", price: 345, quantity: 2, food_type: "2", options_to_add: [] },
    ],
    payment: [{ option: "prepaid" }],
  },
};

test("reads an UrbanPiper order relay", () => {
  assert.equal(isOrderRelay(relay), true);
  assert.equal(isOrderRelay({ new_state: "Cancelled", order_id: 1 }), false);
  const o = parseUrbanPiperOrder(relay);
  assert.equal(o.upOrderId, "3444567");
  assert.equal(o.source, "zomato");
  assert.equal(o.channelOrderId, "1218004251");
  assert.equal(o.type, "delivery");
  assert.equal(o.customerAddress, "Flat 4, HSR Layout, Bengaluru, 560102");
  assert.equal(o.merchantDiscount, 80);
  assert.equal(o.packing, 10);
  assert.equal(o.delivery, 10);
  assert.equal(o.prepaid, true);
  assert.equal(o.otp, "9337");
  assert.deepEqual(o.items[0], {
    name: "Margherita Pizza",
    refId: "m1",
    quantity: 1,
    price: 300,
    foodType: "veg",
    note: "extra spicy",
    addons: [{ group: "Choose Size", name: "Small", price: 200 }, { group: "Option", name: "Cheese ×2", price: 100 }],
  });
  assert.equal(o.items[1].price, 345);
  assert.equal(o.items[1].quantity, 2);
  assert.equal(o.items[1].foodType, "non_veg");
});
