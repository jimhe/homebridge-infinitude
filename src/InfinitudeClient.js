const axios = require('axios');
const parser = require('fast-xml-parser');

module.exports = class InfinitudeClient {
  static get REFRESH_MS() {
    return 10000;
  }

  constructor(url, log) {
    this.url = url;
    this.log = log;
    this.cachedObjects = {};

    this.xmlOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: ''
    };

    setInterval(
      function() {
        this.refreshAll();
      }.bind(this),
      InfinitudeClient.REFRESH_MS
    );
  }

  refreshAll() {
    this.refreshStatus();
    this.refreshSystems();
  }

  refresh(path, handler) {
    return axios
      .get(`${this.url}${path}`, { timeout: 5000 })
      .then(
        function(response) {
          this.cachedObjects[path] = handler(response);
        }.bind(this)
      )
      .catch(
        function(error) {
          this.log.error(error);
        }.bind(this)
      );
  }

  refreshStatus() {
    return this.refresh('/api/status', response => response.data);
  }

  refreshSystems() {
    return this.refresh('/api/config', response => response.data['data']);
  }

  async getSystem() {
    await this.getStatus();
    await this.getConfig();

    return new Promise(
      function(resolve) {
        resolve({
          config: this.cachedObjects['/api/config'],
          status: this.cachedObjects['/api/status']
        });
      }.bind(this)
    );
  }

  async getStatus() {
    if (this.cachedObjects['/api/status'] === undefined) {
      await this.refreshStatus();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/api/status']);
      }.bind(this)
    );
  }

  async getZoneStatus(zoneId) {
    if (this.cachedObjects['/api/status'] === undefined) {
      await this.refreshStatus();
    }


    const status = this.cachedObjects['/api/status'];
    const zone = status['zones'][0]['zone'].filter(zone => zone['id'] === zoneId);
    return new Promise(
      function(resolve) {
        resolve(zone);
      }.bind(this)
    );
  }

  async getConfig() {
    if (this.cachedObjects['/api/config'] === undefined) {
      await this.refreshSystems();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/api/config']);
      }.bind(this)
    );
  }

  setTargetTemperature(zoneId, targetTemperature, setpoint, activity, callback) {
    // zone 1 is at position 0 of the array
    const zoneArrayPosition = zoneId - 1;
    return this.getStatus().then(
      function(status) {
        const zone = status['zones'][0]['zone'].find(zone => zone['id'] === zoneId);

        if (!activity) {
          activity = zone['currentActivity'][0];
        }
        
        const uri = `${this.url}/api/${zoneId}/activity/${activity}?${setpoint}=${targetTemperature}`;
        this.log.info(uri);
        return axios
          .get(uri)
          .then(
            function(result) {
              this.refreshSystems().then(function() {
                if (callback) {
                  callback(null);
                }
              });
              return result;
            }.bind(this)
          )
          .catch(
            function(error) {
              this.log.error(error);
              if (callback) {
                callback(error);
              }
              return error.response;
            }.bind(this)
          );
      }.bind(this)
    );
  }

  setActivity(zoneId, activity, until, callback) {
    let uri = `${this.url}/api/${zoneId}/hold?activity=${activity}&until=${until}`;

    this.log.info(uri);
    return axios
      .get(uri)
      .then(
        function(result) {
          this.refreshSystems().then(function() {
            if (callback) {
              callback(null);
            }
          });
          return result;
        }.bind(this)
      )
      .catch(
        function(error) {
          this.log.error(error);
          if (callback) {
            callback(error);
          }
          return error.response;
        }.bind(this)
      );
  }

  removeHold(zoneId, callback) {
    let uri = `${this.url}/api/${zoneId}/hold?hold=off`;

    this.log.info(uri);
    return axios
      .get(uri)
      .then(
        function(result) {
          this.refreshSystems().then(function() {
            if (callback) {
              callback(null);
            }
          });
          return result;
        }.bind(this)
      )
      .catch(
        function(error) {
          this.log.error(error);
          if (callback) {
            callback(error);
          }
          return error.response;
        }.bind(this)
      );
  }

  setSystemMode(mode, callback) {
    let uri = `${this.url}/api/config?mode=${mode}`;
    const config = this.cachedObjects['/api/config'];
    if (config['mode'][0] !== mode) {
      this.log.info(uri);
      return axios
        .get(uri)
        .then(
          function(result) {
            this.refreshSystems().then(function() {
              if (callback) {
                callback(null);
              }
            });
            return result;
          }.bind(this)
        )
        .catch(
          function(error) {
            this.log.error(error);
            if (callback) {
              callback(error);
            }
            return error.response;
          }.bind(this)
        );
    }
    else {
      return callback(null);
    }
  }

  
  getTemperatureScale() {
    return this.getConfig().then(
      function(config) {
        return config['cfgem'][0];
      }
    )
  }

  
  fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
  }

  celsiusToFahrenheit(temperature) {
    return temperature * 1.8 + 32;
  }

  convertToInfinitude(temperature, scale) {
    if (scale === 'F') {
      return Math.round(this.celsiusToFahrenheit(temperature)).toFixed(1);
    }
    else {
      return temperature;
    }
  }

  convertToHomeKit(temperature, scale) {
    if (scale === 'F') {
      return this.fahrenheitToCelsius(temperature);
    }
    else {
      return temperature;
    }
  }
};
