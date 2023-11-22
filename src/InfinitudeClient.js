const axios = require('axios');
const parser = require('fast-xml-parser');

module.exports = class InfinitudeClient {
  static get REFRESH_MS() {
    return 10000;
  }

  constructor(url, log) {
    this.url = url;
    this.log = log;

    this.xmlOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: ''
    };
  }

  async refresh(path, handler, callback) {
    return axios
      .get(`${this.url}${path}`, { timeout: 5000 })
      .then(
        function (response) {
          if (callback) {
            callback(null);
          }
          return response;
        }.bind(this)
      )
      .catch(
        function (error) {
          this.log.error(error);
        }.bind(this)
      );
  }

  getSystem() {
    return this.getStatus().then(status => {
      return this.getConfig().then(config => {
        return new Promise(
          function (resolve) {
            resolve({
              config: config,
              status: status
            });
          });
      })
    });
  }

  getZoneStatus(zoneId) {
    return this.getStatus('zones').then(zones => {
      const zone = zones['zone'].filter(zone => zone['id'] === zoneId);
      return new Promise(
        function (resolve) {
          resolve(zone[0]);
        });
    });
  }

  getZoneConfig(zoneId) {
    return this.getConfig('zones').then(zones => {
      const zone = zones['zone'].filter(zone => zone['id'] === zoneId);
      return new Promise(
        function (resolve) {
          resolve(zone[0]);
        });
    });
  }

  getTemperatureScale() {
    return this.getConfig('cfgem');
  }

  getCurrentActivity(zoneId) {
    return this.getStatus('zones').then(zones => {
      const zone = zones['zone'].filter(zone => zone['id'] === zoneId);
      return zone[0].currentActivity[0];
    });
  }

  getStatus(path = '') {
    return this.refresh(`/api/status/${path}`).then(response => {
      let value = response.data;

      if (path != '') {
        value = this.getValue(value, path);
      }

      return new Promise(
        function (resolve) {
          resolve(value);
        }.bind(this)
      );
    });
  }

  getConfig(path = '') {
    return this.refresh(`/api/config/${path}`).then(response => {
      let value = response.data['data'];

      return new Promise(
        function (resolve) {
          resolve(value);
        }.bind(this)
      );
    });
  }

  getValue(data, path) {
    const pathParts = path.split('/');
    for (var i = 0; i < pathParts.length; i++) {
      data = data[pathParts[i]];
    }
    return data;
  }

  setTargetTemperature(zoneId, targetTemperature, setpoint, activity, callback) {
    // zone 1 is at position 0 of the array
    const zoneArrayPosition = zoneId - 1;
    return this.getStatus().then(
      function (status) {
        const zone = status['zones'][0]['zone'].find(zone => zone['id'] === zoneId);

        if (!activity) {
          activity = zone['currentActivity'][0];
        }

        const uri = `/api/${zoneId}/activity/${activity}?${setpoint}=${targetTemperature}`;
        return this.refresh(uri, null, callback);
      }.bind(this)
    );
  }

  setActivity(zoneId, activity, until, callback) {
    let uri = `/api/${zoneId}/hold?activity=${activity}&until=${until}`;

    return this.refresh(uri, null, callback);
  }

  removeHold(zoneId, callback) {
    let uri = `/api/${zoneId}/hold?hold=off`;

    return this.refresh(uri, null, callback);
  }

  async setSystemMode(mode, callback) {
    let uri = `/api/config?mode=${mode}`;
    const systemMode = await this.getConfig('mode');
    if (systemMode !== mode) {
      return this.refresh(uri, null, callback);
    } else {
      return callback(null);
    }
  }



  fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
  }

  celsiusToFahrenheit(temperature) {
    return temperature * 1.8 + 32;
  }
};
