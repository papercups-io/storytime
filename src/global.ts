import 'regenerator-runtime/runtime';
import {Storytime} from './index';

const w = window as any;
const config = (w.Papercups && w.Papercups.config) || {};
const {accountId, customer, baseUrl, debug} = config;

if (!accountId) {
  throw new Error('An account token is required to start Storytime!');
}

Storytime.init({
  accountId,
  baseUrl,
  customer,
  debug,
});
