let Characteristic, Service;

	const TemperatureUnit = Object.freeze({
		Celsius: "celsius",
		Fahrenheit: "fahrenheit"
		});

module.exports = class InfinitudeSensor {
  constructor(name, client, log, platformAccessory, service, characteristic) {
    this.name = name;
    //this.zoneId = zoneId;
    this.client = client;
    this.log = log;
				
    Service = service;
    Characteristic = characteristic;
		
    this.initialize(platformAccessory.getService(Service.TemperatureSensor));
  }
  
  initialize(TemperatureSensorService) {
	TemperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
                    minValue: -100,
                    maxValue: 100
                })
      .on('get',
        function(callback) {
          this.getCurrentOutdoorTemperature().then(function(currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );
  }
	
  getCurrentOutdoorTemperature() {
    return this.client.getStatus().then(function(status) {
      return parseFloat(status['oat']);
    });
  }
};
