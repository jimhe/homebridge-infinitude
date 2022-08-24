let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;

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
    service.getCharacteristic(Characteristic.CurrentTemperature).on(
      'get',
      function(callback) {
        this.getCurrentOutdoorTemperature().then(function(currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );
  }

  getCurrentOutdoorTemperature() {
    return this.client.getStatus().then(
      function(status) {
        return this.client.fahrenheitToCelsius(parseFloat(status['oat'][0]), this.client.getTemperatureScale());
      }.bind(this)
    );
  }
};
