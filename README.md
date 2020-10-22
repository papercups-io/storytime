# Storytime

WIP

### In HTML

```html
<script>
  window.Papercups = {
    config: {
      accountId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx',
      // Optionally pass in metadata to identify the customer
      customer: {
        name: 'Test User',
        email: 'test@test.com',
        external_id: '123',
      },
      // Optionally specify the base URL
      baseUrl: 'https://app.papercups.io',
      // Optionally enable debug mode
      debug: false
    },
  };
</script>
<script
  type="text/javascript"
  async
  defer
  src="https://app.papercups.io/storytime.js"
></script>
```
