# Courier tracking webhook

Configure the backend environment variable `SHIPROCKET_WEBHOOK_TOKEN` with a
high-entropy secret, then configure the courier webhook to send that same value
in the `x-api-key` request header.

The endpoint is:

```text
POST /api/integrations/courier-events
Content-Type: application/json
x-api-key: <configured webhook token>
```

The route is mounted before customer store resolution and CSRF middleware. It
accepts only authenticated POST delivery notifications, validates the courier
payload, and acknowledges delivery only after event persistence succeeds or
duplicate events are confirmed. Keep the token private and rotate it in both
configurations together.
