"use client";

import { useParams } from "next/navigation";
import { PosScreen } from "@/components/pos/pos-screen";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return <PosScreen key={id} orderId={id} />;
}
