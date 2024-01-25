let Characteristic, Service;

module.exports = class InfinitudeFan {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;
    this.zoneId = zoneId;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.Fanv2));
    this.bindInformation(platformAccessory.getService(Service.AccessoryInformation));
  }

  bindInformation(service) {
    if (this.config.advancedDetails != undefined) {
      service
        .setCharacteristic(Characteristic.Manufacturer, this.config.advancedDetails.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.advancedDetails.model)
        .setCharacteristic(Characteristic.SerialNumber, `${this.config.advancedDetails.serial}-f`);
    }
  }

  initialize(service) {
    service.getCharacteristic(Characteristic.Active)
      .onGet(this.getActiveState.bind(this));

    service.getCharacteristic(Characteristic.TargetFanState)
      .onGet(this.getTargetFanState.bind(this));

    service.getCharacteristic(Characteristic.CurrentFanState)
      .onGet(this.getCurrentState.bind(this));
  }

  async getCurrentState() {
    const status = await this.getZoneStatus()
    switch (status['fan'][0]) {
      case 'off':
        return Characteristic.CurrentFanState.IDLE;
      default:
        return Characteristic.CurrentFanState.BLOWING_AIR;
    }
  }

  async getActiveState() {
    const status = await this.getZoneStatus();
    switch (status['fan'][0]) {
      case 'off':
        return Characteristic.Active.INACTIVE;
      default:
        return Characteristic.Active.ACTIVE;
    }
  }

  async getTargetFanState() {
    const activity = await this.getScheduledActivity();
    switch (activity['fan'][0]) {
      case 'auto':
        return Characteristic.TargetFanState.AUTO;
      default:
        return Characteristic.TargetFanState.MANUAL;
    }
  }

  async getZoneStatus() {
    const zones = await this.client.getStatus('zones');
    return zones['zone'].find(zone => zone['id'] === this.zoneId);
  }

  async getScheduledActivity() {
    const system = await this.client.getSystem();

    var localTime = system.status['localTime'][0].substring(0, 19);
    var systemDate = new Date(localTime);
    var dayOfWeek = systemDate.getDay();
    var time = systemDate.getHours() * 100 + systemDate.getMinutes();
    var zoneConfig = system.config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
    var activePeriods = zoneConfig['program'][0]['day'][dayOfWeek]['period'].filter(p => {
      var timePieces = p['time'][0].split(':');
      var periodTime = timePieces[0] * 100 + timePieces[1] * 1;
      return p['enabled'][0] === 'on' && periodTime <= time;
    });

    var activityName = 'home';
    if (activePeriods.length > 0) {
      activityName = activePeriods[activePeriods.length - 1]['activity'][0];
    } else {
      var zoneStatus = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      activityName = zoneStatus['currentActivity'][0];
    }

    var activity = zoneConfig['activities'][0]['activity'].find(act => act['id'] === activityName);
    return activity;
  }
};
