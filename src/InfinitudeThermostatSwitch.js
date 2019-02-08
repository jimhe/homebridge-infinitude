const InfinitudeAccessory = require('./InfinitudeAccessory');

const Characteristic = require('hap-nodejs').Characteristic;
const Switch = require('hap-nodejs').Service.Switch;

module.exports = class InfinitudeThermostatSwitch extends InfinitudeAccessory {
  constructor(name, zoneId, client, log, platformAccessory) {
    super(name, zoneId, client, log);
    this.initialize(platformAccessory.getService(Switch));
  }

  initialize(switchService) {
    switchService
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function(callback) {
          this.getTargetHeatingCoolingState().then(function(state) {
            switch (state) {
              case Characteristic.TargetHeatingCoolingState.AUTO:
                callback(null, true);
                break;
              default:
                callback(null, false);
                break;
            }
          });
        }.bind(this)
      )
      .on(
        'set',
        function(value, callback) {
          if (value) {
            return this.client.setActivity(this.zoneId, 'home', callback);
          } else {
            return this.client.setActivity(this.zoneId, 'away', callback);
          }
        }.bind(this)
      );
  }
};
