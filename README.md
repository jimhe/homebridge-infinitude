# homebridge-infinitude
[Infinitude](https://github.com/nebulous/infinitude) Plugin for Homebridge

# Behavior
This plugin will create thermostat accessories for each enabled zone in infinitude. For simplicity, it only supports `OFF` or `AUTO` mode:
 - In `OFF` mode, it will set infinitude activity for that zone to `away`.
 - In `AUTO` mode, it will set infinitude activity for that zone to `manual`. Upon adjusting the target temperatures,
 it will update that zone's `manual` activity's `clsp` and `htsp` accordingly.
 
Other settings:
 - If `holdUntil` is specified, it will set `otmr` to the specified hour when changing to `AUTO` mode.

HomeKit Features:
- **Thermostat Control**: Set Target Temperature for Heat & Cooling. Infinitude values `htsp` and `clsp` respectively.
- **Current Temperature:** Dislays current temperature reported by the zone thermostat. Infinitude values `rt`
- **Hardware Display Unit:** control temperature unit (Celcius/Fahrenheit) of physical Theromstat.
- **Filter Life Level:** Displays life of Filter, `0` being breand new and `100` needing replacement. Infinitude value `filtrlvl`
- **Current Relative Humidity:** Displays indoor humidity reported by Thermostat. Infinitude value `rh`

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

If running Infinitude & Homebridge on same devive, e.g., Raspberry Pi, use LocalHost 127.0.0.1 for url.

## Running Infinitude
```
docker run -d -e MODE='Production' -e PASS_REQS='0' jimhe/infinitude:1.0.0
```
[Instructions for Raspberry Pi](https://github.com/nebulous/infinitude/wiki/Installing-Infinitude-on-Raspberry-PI-(raspbian))

## Useful HomeKit Automations / Scenes:
You can use HomeKit to completely control your thermostat's schedule.

**Scenes -** I use scenes to create my desired temperature profiles for both Heat & Cool, e.g.,:

- Climate Home - desired settings for during the day when I am home.
- Climate Away - desired settings for while the house is empty.
- Climate Sleep - desired settings for while we sleep.

**Automations -** I use time and location based Automations to trigger my scenes. e.g.,:
- At 6:00 AM - Climate Home
- At 11:00 PM - Climate Sleep
- When Last Person Leaves - Climate Away
- When First Person Arrives - Climate Home

**Shortcuts -** I use a personal automation in Shortcuts to tell me if I need to change my air filter.

<img src="https://user-images.githubusercontent.com/8211291/114083700-52a7e180-987d-11eb-8b2c-5287763a8e1c.PNG" width=300>
