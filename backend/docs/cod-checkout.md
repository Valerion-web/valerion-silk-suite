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
