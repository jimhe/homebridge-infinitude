const server = require('../node_modules/homebridge/lib/server');
const nock = require('nock');
const InfinitudePlatform = require('../src/InfinitudePlatform');
const User = require('../node_modules/homebridge/lib/user').User;
const _ = require('lodash');

global.console = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };

describe('InfinitudePlatform', () => {
  const config = {
    platform: 'InfinitudePlatform',
    url: 'http://localhost'
  };

  let homebridgeServer, homebridgeApi;
  let HAP, Characteristic;

  User.setStoragePath(
    `./tmp/${Math.random()
      .toString(36)
      .substring(7)}`
  );

  homebridgeServer = new server.Server();
  homebridgeApi = homebridgeServer._api;
  HAP = homebridgeApi.hap;
  const platform = new InfinitudePlatform(console, config, homebridgeApi);
  Characteristic = HAP.Characteristic;

  nock(config.url)
    .get('/status.xml')
    .replyWithFile(200, '__tests__/resources/status.xml', {
      'Content-Type': 'application/xml'
    })
    .get('/systems.json')
    .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
      'Content-Type': 'application/json'
    });

  homebridgeApi.emit('didFinishLaunching');

  test('Characteristics all work', done => {
    homebridgeApi.on('didFinishInit', async function() {
      const accessories = homebridgeServer._cachedPlatformAccessories;
      expect(accessories).toHaveLength(2);
      expect(
        _.isMatch(accessories, [{ displayName: 'Downstairs Thermostat' }, { displayName: 'Upstairs Thermostat' }])
      ).toBe(true);

      const accessory = accessories[0];
      const temperatureDisplayUnits = await platform.getValue(accessory, Characteristic.TemperatureDisplayUnits);
      const currentTemperature = await platform.getValue(accessory, Characteristic.CurrentTemperature);
      const currentState = await platform.getValue(accessory, Characteristic.CurrentHeatingCoolingState);
      const targetState = await platform.getValue(accessory, Characteristic.TargetHeatingCoolingState);
      const heatingThresholdTemperature = await platform.getValue(
        accessory,
        Characteristic.HeatingThresholdTemperature
      );
      const coolingThresholdTemperature = await platform.getValue(
        accessory,
        Characteristic.CoolingThresholdTemperature
      );
      const humidity = await platform.getValue(accessory, Characteristic.CurrentRelativeHumidity);

      expect(temperatureDisplayUnits).toBe(Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
      expect(currentTemperature).toBeCloseTo(InfinitudePlatform.convertInfinitudeTemperature(69), 0);
      expect(currentState).toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
      expect(targetState).toBe(Characteristic.TargetHeatingCoolingState.AUTO);
      expect(heatingThresholdTemperature).toBeCloseTo(InfinitudePlatform.convertInfinitudeTemperature(66), 0);
      expect(coolingThresholdTemperature).toBeCloseTo(InfinitudePlatform.convertInfinitudeTemperature(74), 0);
      expect(humidity).toBe(53);

      nock(config.url)
        .post(
          '/systems/infinitude',
          _.matches({
            system: [
              {
                config: [
                  {
                    zones: [
                      {
                        zone: [
                          {
                            id: '1',
                            holdActivity: ['away']
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          })
        )
        .reply(200);

      await platform.setValue(
        accessory,
        Characteristic.TargetHeatingCoolingState,
        Characteristic.TargetHeatingCoolingState.OFF
      );

      // Temperature changes unsupported
      await platform.setValue(accessory, Characteristic.HeatingThresholdTemperature, 10);
      await platform.setValue(accessory, Characteristic.CoolingThresholdTemperature, 10);
      await platform.setValue(accessory, Characteristic.TargetTemperature, 10);

      // Heat / Cool unsupported
      await platform.setValue(
        accessory,
        Characteristic.TargetHeatingCoolingState,
        Characteristic.TargetHeatingCoolingState.HEAT
      );
      await platform.setValue(
        accessory,
        Characteristic.TargetHeatingCoolingState,
        Characteristic.TargetHeatingCoolingState.COOL
      );

      expect(nock.isDone()).toBe(true);
      done();
    });
  });
});
