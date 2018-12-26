# homebridge-infinitude
Infinitude Plugin for Homebridge

# Development

1. Add `InfinitudePlatform` to `platforms`in new `config.json`:
```json
{
  "platform": "InfinitudePlatform",
  "url": "http://10.0.0.142:3001"
}
```
2. `yarn && yarn test && yarn start`