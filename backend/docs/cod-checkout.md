# Cash-on-delivery checkout

Customer checkout routes require an authenticated user and a concrete store.
The storefront sends local cart product slugs and selected size/color options;
the API resolves them to active products and variants for that store and uses
database prices and stock. Client-supplied prices and totals are ignored.

## Check eligibility

`POST /api/checkout/cod/eligibility`

```json
{
  "items": [
    { "slug": "product-slug", "size": "M", "color": "#071120", "quantity": 1 }
  ]
}
```

The response includes the server-computed INR subtotal, discount, shipping,
total, and an `eligible` flag. The final total must be positive and strictly
below ₹50,000, including shipping.

## Place a COD order

`POST /api/checkout/cod`

The request uses the same `items` array and adds a stable `idempotencyKey` and
shipping address:

```json
{
  "idempotencyKey": "checkout-attempt-uuid",
  "items": [
    { "slug": "product-slug", "size": "M", "color": "#071120", "quantity": 1 }
  ],
  "shippingAddress": {
    "name": "Recipient",
    "phone": "+91 9876543210",
    "email": "recipient@example.test",
    "line1": "Street address",
    "line2": null,
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "country": "India"
  }
}
```

The order, stock deductions, COD payment obligation, and shipment queue entry
are committed in one serializable transaction. The payment is recorded as
`provider: COD`, `status: PENDING_COLLECTION`; the order is not marked paid.
Retries with the same key and identical request return the existing order.
Reusing a key for another payment method or changed request is rejected.

The shipment worker continues to require administrator-confirmed package
measurements. It submits COD orders with Shiprocket's `COD` payment method and
the validated outstanding order amount as `cod_amount`. Uncertain provider
submissions remain in reconciliation rather than being blindly retried.

The Phase 2 migrations are `20261109000000_add_cod_checkout` and
`20261109000001_enforce_cod_payment_state`.

## Collection, cancellation, and payment lifecycle

The payment remains `PENDING_COLLECTION` after shipment creation, shipment
failure, retry, reconciliation, and courier tracking updates. A courier's
delivered event does not itself prove cash was received.

An administrator with the `orders` capability and a concrete store can confirm
collection with `POST /api/admin/orders/:id/cod-collection` after the shipment's
latest tracking status is `Delivered`:

```json
{
  "confirmCashReconciled": true,
  "reconciledAmount": 1250.50
}
```

The supplied reconciled amount must match the outstanding payment and order
total exactly. The transaction conditionally changes the COD payment to
`COD_COLLECTED` and records the confirming administrator and timestamp. A
duplicate or concurrent confirmation is rejected.

Cancelling an order with a pending COD obligation atomically changes the
payment to `CANCELLED` with the order status and history. Cancelling an order
whose COD payment is already collected is rejected; no refund action is
available until a real refund process is implemented.

COD payment states are constrained to `PENDING_COLLECTION`, `COD_COLLECTED`,
`CANCELLED`, or `REFUNDED`. Collection metadata is required for `COD_COLLECTED`
and `REFUNDED`, and absent for `PENDING_COLLECTION` and `CANCELLED`. COD
payments cannot carry Razorpay identifiers.

The additive migrations are `20261109000000_add_cod_checkout`,
`20261109000001_enforce_cod_payment_state`,
`20261109000002_add_cod_collected_status`, and
`20261109000003_enforce_cod_payment_lifecycle`. Enum additions and the
constraint using the added enum value are deliberately separate migrations.
