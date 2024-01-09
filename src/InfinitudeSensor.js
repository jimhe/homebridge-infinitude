const InfinitudeHelper = require('./InfinitudeHelper');
let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;
    this.helper = new InfinitudeHelper();
    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.TemperatureSensor));
    this.bindInformation(platformAccessory.getService(Service.AccessoryInformation));
  }

  bindInformation(service) {
    if (this.config.advancedDetails != undefined) {
      service
        .setCharacteristic(Characteristic.Manufacturer, this.config.advancedDetails.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.advancedDetails.model)
        .setCharacteristic(Characteristic.SerialNumber, `${this.config.advancedDetails.serial}-s`);
    }
  }

  initialize(service) {
    service.getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentOutdoorTemperature.bind(this));
  }

  async getCurrentOutdoorTemperature() {
    var tempScale = await this.client.getTemperatureScale();
    let outdoorTemp = await this.client.getStatus('oat');
    outdoorTemp = parseFloat(outdoorTemp);
    outdoorTemp = this.helper.convertToHomeKit(outdoorTemp, tempScale);
    return outdoorTemp;
  }
};
