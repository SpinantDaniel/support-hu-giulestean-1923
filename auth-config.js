const isHubProduction=/^(?:www\.)?hubgiulestean\.ro$/i.test(location.hostname);

window.HUB_AUTH_CONFIG=Object.freeze({
  // Preview uses Cloudflare's official always-pass testing sitekey.
  // Production intentionally fails closed until the real Turnstile sitekey
  // is committed during the Step 3 activation gate.
  turnstileSiteKey:isHubProduction?'':'1x00000000000000000000AA',
  turnstileMode:isHubProduction?'production-unconfigured':'preview-test',
  termsVersion:'1.0',
  privacyVersion:'1.0'
});
