let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;

    Service = service;
    Characteristic = characteristic;

    this.temperatureService = platformAccessory.getService(Service.TemperatureSensor);
    this.bindInformation(platformAccessory.getService(Service.AccessoryInformation));

    // Update the temperature every 2 minutes (120000 milliseconds)
    setInterval(this.updateTemperature.bind(this), 120000);

    // Initial temperature update
    this.updateTemperature();
  }

  bindInformation(service) {
    if (this.config.advancedDetails != undefined) {
      service
        .setCharacteristic(Characteristic.Manufacturer, this.config.advancedDetails.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.advancedDetails.model)
        .setCharacteristic(Characteristic.SerialNumber, `${this.config.advancedDetails.serial}-s`);
    }
  }

  updateTemperature() {
    this.getCurrentOutdoorTemperature()
      .then(currentTemperature => {
        // Update the TemperatureSensor characteristic with the new temperature value
        this.temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, currentTemperature);
       // this.log(`Outdoor temperature updated to: ${currentTemperature}°C`);
      })
      .catch(error => {
      //  this.log(`Error updating outdoor temperature: ${error}`);
      });
  }

  getCurrentOutdoorTemperature() {
    return this.client.getStatus('oat').then(oat => {
      return this.client.fahrenheitToCelsius(parseFloat(oat), this.client.getTemperatureScale());
    });
  }
};
