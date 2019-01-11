# homebridge-infinitude
[Infinitude](https://github.com/nebulous/infinitude) Plugin for Homebridge

# Install

## Homebridge Configuration
```json
{
  "platforms": [
    {
      "platform": "InfinitudePlatform",
      "url": "http://<infinitude host>:<infinitude port>"
    }
  ]
}
```

# Development

1. Add `InfinitudePlatform` to `platforms`in new `config.json`, see [homebridge configuration](#homebridge-configuration)
2. `yarn && yarn test && yarn start`

To reset cache: `yarn dropcache`
