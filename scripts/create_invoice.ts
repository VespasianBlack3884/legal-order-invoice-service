const response = await fetch("http://localhost:3000/orders/invoice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: "order-1042",
    matter: {
      reference: "MAT-2026-014",
      clientName: "Northwind Legal",
      description: "Trademark filing and signed document review",
    },
    delivery: { recipientEmail: "ops@example.com" },
    deadline: "2026-09-02T09:00:00.000Z",
    invoice: { currency: "USD", amount: 480 },
  }),
});

const result: unknown = await response.json();
console.log(JSON.stringify(result, null, 2));
