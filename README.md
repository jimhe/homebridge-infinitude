# Deprecated
New maintainer is https://github.com/dotfortun3-code/homebridge-infinitude-schedules

# homebridge-infinitude
[Infinitude](https://github.com/nebulous/infinitude) Plugin for Homebridge

# Behavior
This plugin will create thermostat accessories for each enabled zone in infinitude. For simplicity, it only supports `OFF` or `AUTO` mode:
 - In `OFF` mode, it will set infinitude activity for that zone to `away`.
 - In `AUTO` mode, it will set infinitude activity for that zone to `manual`. Upon adjusting the target temperatures,
 it will update that zone's `manual` activity's `clsp` and `htsp` accordingly.
 
Other settings:
 - If `holdUntil` is specified, it will set `otmr` to the specified hour when changing to `AUTO` mode.

# Install

## Homebridge Configuration
```json
{
  "platforms": [
    {
      "platform": "InfinitudePlatform",
      "url": "http://<infinitude host>:<infinitude port>",
      "holdUntil": "00:00"
    }
  ]
}
```

## Running Infinitude
```
docker run -d -e MODE='Production' -e PASS_REQS='0' jimhe/infinitude:1.0.0
```

# Development

1. Add `InfinitudePlatform` to `platforms`in new `config.json` in root directory of this repository.
2. `yarn && yarn test && yarn start`

To reset cache: `yarn dropcache`
