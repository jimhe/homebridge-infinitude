const Characteristic = require('hap-nodejs').Characteristic;

module.exports = class InfinitudeAccessory {
  constructor(name, zoneId, client, log) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;
  }

  getTargetHeatingCoolingState() {
    return this.getTargetActivityId().then(
      function(targetActivityId) {
        switch (targetActivityId) {
          case 'away':
            return Characteristic.TargetHeatingCoolingState.OFF;
          case 'home':
            return Characteristic.TargetHeatingCoolingState.AUTO;
          default:
            this.log.warn(`Unexpected activity ${targetActivityId} for ${this.name}`);
            return Characteristic.TargetHeatingCoolingState.OFF;
        }
      }.bind(this)
    );
  }

  getTargetActivityId() {
    return this.getZoneTarget().then(function(zoneTarget) {
      return zoneTarget['holdActivity'][0];
    });
  }

  getZoneTarget() {
    return this.client.getSystems().then(
      function(systems) {
        return systems['system'][0]['config'][0]['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }
};
