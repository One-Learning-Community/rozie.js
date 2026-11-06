---
"@rozie-ui/captcha-react": patch
"@rozie-ui/captcha-vue": patch
"@rozie-ui/captcha-svelte": patch
"@rozie-ui/captcha-angular": patch
"@rozie-ui/captcha-solid": patch
"@rozie-ui/captcha-lit": patch
---

README fixes: Angular examples use the `<rozie-captcha>` and `<rozie-recaptcha-v3>` selectors (the PascalCase tags they showed fail to compile with NG8001); the `verify` handler takes the `unknown` output payload, and the forms example sets the required `sitekey`.
