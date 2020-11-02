# @papercups-io/storytime

> Papercups screen sharing feature

[![NPM](https://img.shields.io/npm/v/@papercups-io/storytime.svg)](https://www.npmjs.com/package/@papercups-io/storytime) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Demo

**Screenshot:**
<img width="1190" alt="Screen Shot 2020-11-02 at 2 35 02 PM" src="https://user-images.githubusercontent.com/5264279/97911075-b3ece700-1d18-11eb-875d-07db7c4f20b7.png">

**GIF:**
![demo](https://user-images.githubusercontent.com/5264279/96898977-56c27d00-145e-11eb-907b-ca8db13a0fa0.gif)

## Install

```bash
npm install --save @papercups-io/storytime
```

## Usage

First, sign up at https://app.papercups.io/register to get your account token. Your account token is what you will use to pass in as the `accountId` prop below.

### Using in HTML

Paste the code below between your `<head>` and `</head>` tags:

```html
<!-- 
  Note that if you already have included the `window.Papercups` configuration with the chat widget, 
  you should **NOT** duplicate it here! All the config settings should be the same for now.
-->
<script>
  window.Papercups = {
    config: {
      // Pass in your Papercups account token here after signing up
      accountId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx',
      // Optionally pass in metadata to identify the customer
      customer: {
        name: 'Test User',
        email: 'test@test.com',
        external_id: '123',
      },
      // Optionally specify the base URL
      baseUrl: 'https://app.papercups.io',
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

_:warning: **Note** that if you already have included the `window.Papercups` configuration with the [chat widget](https://github.com/papercups-io/chat-widget#using-in-html), you should **NOT** duplicate it here!_

If you **already** have the config set, just include this script below it:

```html
<script
  type="text/javascript"
  async
  defer
  src="https://app.papercups.io/storytime.js"
></script>
```

### Using as an NPM module

Place the code below in any pages on which you would like to render the widget. If you'd like to render it in all pages by default, place it in the root component of your app.

```tsx
import {Storytime} from '@papercups-io/storytime';

const st = Storytime.init({
  // Pass in your Papercups account token here after signing up 
  accountId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx',
  // Optionally specify the base URL
  baseUrl: 'https://app.papercups.io',
});

// If you want to stop the session recording manually, you can call:
// st.finish();

// Otherwise, the recording will stop as soon as the user exits your website.
```
