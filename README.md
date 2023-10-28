<p align="center"> <a href="https://github.com/nebulous/infinitude"><img src="https://user-images.githubusercontent.com/8211291/131715404-6aa429a1-6a57-447c-b1b6-7ac84ee79977.jpg" height=90></a></p>

# homebridge-infinitude
[Infinitude](https://github.com/nebulous/infinitude) Plugin for Homebridge. Enable Carrier/Bryant Infinity Touch Thermostats in HomeKit.

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

What is Infinitude? Infinitude is an alternative web service for Carrier Infinity Touch and other compatible thermostats. It allows read and control of your Infinity system locally over your network (no serial connection needed).

# Behavior
This plugin will create thermostat accessories for each enabled zone in infinitude.
 - In `OFF` mode, it will set infinitude activity for that zone to `off`, unless `shutOffAway` is true.
 - In `HEAT` or `COOL` mode, it will set infinitude activity to the set temperature in the relevant mode.
 - In `AUTO` mode, it will set infinitude activity for that zone to `Auto` to automatically adjust between heating and cooling points. This implementation currently is not working fully.
 - If you have a thermostat schedule, the temperature change will be made temporarily within the current profile using the plugin's `holdUntil`value.
 
Other settings:
 - If `holdUntil` is specified, it will set `otmr` to the specified hour.

HomeKit Features:
- **Thermostat Control**: Set Target Temperature for Heat & Cooling. Infinitude values `htsp` and `clsp` respectively.
- **Read Only Fan**: Currently provides data on whether the fan is On or Off. Hopefully control will come soon.
- **Current Temperature:** Dislays current temperature reported by the zone thermostat. Infinitude values `rt`
- **Hardware Display Unit:** control temperature unit (Celcius/Fahrenheit) of physical Theromstat.
- **Filter Life Level:** Displays life of Filter, `100` being brand new and `0` needing replacement. Infinitude value `filtrlvl`
- **Current Relative Humidity:** Displays indoor humidity reported by Thermostat. Infinitude value `rh`

# Install

Use Homebridge-UI-X and Search for homebridge-infinitude

OR

run `sudo npm i -g homebridge-infinitude-v2`

## Homebridge Configuration
```json
{
  "platform": "InfinitudePlatform",
  "thermostats": [
      {
          "name": "Home",
          "advancedDetails": {
              "manufacturer": "Default-Manufacturer",
              "model": "Default-Model",
              "serial": "Default-SerialNumber"
          },
          "url": "http://<infinitude host>:<infinitude port>",
          "shutOffAway": false,
          "holdUntilNextActivity": false,
          "useFan": false,
          "useOutdoorTemperatureSensor": true
      },
      {
          "name": "Office",
          "advancedDetails": {
              "manufacturer": "Default-Manufacturer",
              "model": "Default-Model",
              "serial": "Default-SerialNumber"
          },
          "url": "http://<infinitude host>:<infinitude port>",
          "shutOffAway": false,
          "holdUntilNextActivity": false,
          "useFan": false,
          "useOutdoorTemperatureSensor": false
      }
  ]
}
```

If running Infinitude & Homebridge on same devive, e.g., Raspberry Pi, use LocalHost 127.0.0.1 for url.

## Running Infinitude

[Instructions for Raspberry Pi](https://github.com/nebulous/infinitude/wiki/Installing-Infinitude-on-Raspberry-PI-(raspbian))

[Running Infinitude on Homebridge Raspbian Image](https://github.com/rcoletti116/homebridge-infinitude/wiki/Running-Infinitude-on-Homebridge-Raspbian-Image)

## Local Control
If you want to keep your IOT devices completely local, you can accomplish this with Infinitude. The carrier web services seem harmless, but local control is often a desirable preference for speed, reliability, and future-proofing against cloud services being sunset. To support local-only control, you will need to use your firewall to block access from your Infinitude Client to the following hostnames:

- legacy.api.iot.carrier.com
- www.api.ing.carrier.com

Local communication between your Thermostat-Infinitude-HomeKit will function, but the Carrier and other official apps will no longer work.

## Useful HomeKit Automations / Scenes Ideas:
You can use HomeKit to completely control your thermostat's schedule.

**Scenes -** Use scenes to create desired temperature profiles for both Heat & Cool, e.g.,:

- Climate Home - desired settings for during the day when I am home.
- Climate Away - desired settings for while the house is empty.
- Climate Sleep - desired settings for while we sleep.

**Automations -** Use time and location based Automations to trigger my scenes. e.g.,:
- At 6:00 AM - Climate Home
- At 11:00 PM - Climate Sleep
- When Last Person Leaves - Climate Away
- When First Person Arrives - Climate Home

**Shortcuts -** Use personal automations in Shortcuts for advanced functions like Air Filter Reminders:

<img src="https://user-images.githubusercontent.com/8211291/114083700-52a7e180-987d-11eb-8b2c-5287763a8e1c.PNG" width=300>
