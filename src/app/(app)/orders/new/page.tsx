"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { PosScreen } from "@/components/pos/pos-screen";
import { ORDER_TYPES } from "@/lib/utils";

function NewOrder() {
  const sp = useSearchParams();
  const requested = sp.get("type") ?? "dine_in";
  const type = (ORDER_TYPES as readonly string[]).includes(requested) ? requested : "dine_in";
  const tableId = type === "dine_in" ? sp.get("table") : null;
  return <PosScreen key={`${type}-${tableId}`} newOrder={{ type, tableId }} />;
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewOrder />
    </Suspense>
  );
}
