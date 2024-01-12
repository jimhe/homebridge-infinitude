let Characteristic, Service;

module.exports = class InfinitudeSwitch {
  homeService;
  sleepService;
  awayService;
  wakeService;

  constructor(name, client, log, config, platformAccessory, service, characteristic, zoneId) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;
    this.zoneId = zoneId;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory);
    this.bindInformation(platformAccessory.getService(Service.AccessoryInformation));
  }

  bindInformation(service) {
    if (this.config.advancedDetails != undefined) {
      service
        .setCharacteristic(Characteristic.Manufacturer, this.config.advancedDetails.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.advancedDetails.model)
        .setCharacteristic(Characteristic.SerialNumber, `${this.config.advancedDetails.serial}-sw`);
    }
  }

  initialize(accessory) {
    this.homeService = accessory.getService("H" + accessory.id);
    this.homeService.getCharacteristic(Characteristic.On)
      .onSet(this.setHomeOn.bind(this))
      .onGet(this.getHomeOn.bind(this));

    this.awayService = accessory.getService("A" + accessory.id);
    this.awayService.getCharacteristic(Characteristic.On)
      .onSet(this.setAwayOn.bind(this))
      .onGet(this.getAwayOn.bind(this));

    this.wakeService = accessory.getService("W" + accessory.id);
    this.wakeService.getCharacteristic(Characteristic.On)
      .onSet(this.setWakeOn.bind(this))
      .onGet(this.getWakeOn.bind(this));

    this.sleepService = accessory.getService("S" + accessory.id);
    this.sleepService.getCharacteristic(Characteristic.On)
      .onSet(this.setSleepOn.bind(this))
      .onGet(this.getSleepOn.bind(this));
  }

  async setHomeOn(value) {
    if (value == true) {
      await this.client.setActivity(this.zoneId, "home", 'forever');
      this.awayService.updateCharacteristic(Characteristic.On, false);
      this.wakeService.updateCharacteristic(Characteristic.On, false);
      this.sleepService.updateCharacteristic(Characteristic.On, false);
    }
  }

  async getHomeOn() {
    const currentActivity = await this.client.getCurrentActivity(this.zoneId);

    return currentActivity == "home";
  }
  async setAwayOn(value) {
    if (value == true) {
      await this.client.setActivity(this.zoneId, "away", 'forever');
      this.wakeService.updateCharacteristic(Characteristic.On, false);
      this.sleepService.updateCharacteristic(Characteristic.On, false);
      this.homeService.updateCharacteristic(Characteristic.On, false);
    }
  }

  async getAwayOn() {
    const currentActivity = await this.client.getCurrentActivity(this.zoneId);

    return currentActivity == "away";
  }
  async setWakeOn(value) {
    if (value == true) {
      await this.client.setActivity(this.zoneId, "wake", 'forever');
      this.awayService.updateCharacteristic(Characteristic.On, false);
      this.sleepService.updateCharacteristic(Characteristic.On, false);
      this.homeService.updateCharacteristic(Characteristic.On, false);
    }
  }

  async getWakeOn() {
    const currentActivity = await this.client.getCurrentActivity(this.zoneId);

    return currentActivity == "wake";
  }
  async setSleepOn(value) {
    if (value == true) {
      await this.client.setActivity(this.zoneId, "sleep", 'forever');
      this.awayService.updateCharacteristic(Characteristic.On, false);
      this.wakeService.updateCharacteristic(Characteristic.On, false);
      this.homeService.updateCharacteristic(Characteristic.On, false);
    }
  }

  async getSleepOn() {
    const currentActivity = await this.client.getCurrentActivity(this.zoneId);
    return currentActivity == "sleep";
  }
};
