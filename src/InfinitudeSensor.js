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
    this.temperatureService = platformAccessory.getService(Service.TemperatureSensor);
    this.initialize();
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

  initialize() {
    if (this.config.pollOutdoorSensor) {
      this.initializePolling();
    }
    else {
      this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
        .onGet(this.getCurrentOutdoorTemperature.bind(this));
    }
  }

  initializePolling() {
    let pollTime = this.config.sensorPollTime * 1000;
    this.log.verbose(`Setting outdoor sensor poll time to ${pollTime}ms`);
    // Update the temperature every pollTime milliseconds
    setInterval(this.updateTemperature.bind(this), pollTime);
    // Initial temperature update
    this.updateTemperature();
  }

  async updateTemperature() {
    const currentTemperature = await this.getCurrentOutdoorTemperature();

    // Update the TemperatureSensor characteristic with the new temperature value
    this.temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, currentTemperature);
    this.log.verbose(`Outdoor temperature updated to: ${currentTemperature}°`);
  }

  async getCurrentOutdoorTemperature() {
    var tempScale = await this.client.getTemperatureScale();
    let outdoorTemp = await this.client.getStatus('oat');
    outdoorTemp = parseFloat(outdoorTemp);
    outdoorTemp = this.helper.convertToHomeKit(outdoorTemp, tempScale);
    return outdoorTemp;
  }
};
