const axios = require('axios');

module.exports = class InfinitudeClient {
  static get CACHE_DURATION() {
    return 15000;
  }

  cache = {};

  constructor(url, log) {
    this.url = url;
    this.log = log;

    this.getSystem();
    setInterval(this.refreshCache.bind(this), InfinitudeClient.CACHE_DURATION);
  }

  async refresh(path) {
    this.log.verbose(`calling ${this.url}${path}`);
    return axios
      .get(`${this.url}${path}`, { timeout: 5000 })
      .then(
        function (response) {
          return response;
        }.bind(this)
      )
      .catch(
        function (error) {
          this.log.error(error);
        }.bind(this)
      );
  }

  refreshCache() {
    for (const key in this.cache) {
      if (key.startsWith('/api/status/')) {
        this.getStatus(key.replace('/api/status/', ''), true);
      }
      else if (key.startsWith('/api/config/')) {
        this.getConfig(key.replace('/api/config/', ''), true);
      }
    }
  }

  getCache(path) {
    this.log.verbose(`cache ${this.url}${path}`);
    return this.cache[path];
  }

  cacheRefreshNeeded(path) {
    const value = this.cache[path];
    const currDate = new Date();
    return value == null || (currDate.getTime() - value.lastUpdate.getTime()) > InfinitudeClient.CACHE_DURATION;
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

  getStatus(path = '', refresh = false) {
    const statusPath = `/api/status/${path}`;
    if (refresh || this.cacheRefreshNeeded(statusPath)) {
      return this.refresh(statusPath).then(response => {
        let value = response.data;
        this.cache[statusPath] = { value: value, lastUpdate: new Date() };

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
    else {
      let value = this.getCache(statusPath).value;

      if (path != '') {
        value = this.getValue(value, path);
      }

      return new Promise(
        function (resolve) {
          resolve(value);
        }.bind(this)
      );
    }
  }

  getConfig(path = '', refresh = false) {
    const configPath = `/api/config/${path}`;
    if (refresh || this.cacheRefreshNeeded(configPath)) {

      return this.refresh(configPath).then(response => {
        let value = response.data['data'];
        this.cache[configPath] = { value: value, lastUpdate: new Date() };

        return new Promise(
          function (resolve) {
            resolve(value);
          }.bind(this)
        );
      });
    }
    else {
      let value = this.getCache(configPath).value;

      return new Promise(
        function (resolve) {
          resolve(value);
        }.bind(this)
      );
    }
  }

  getValue(data, path) {
    const pathParts = path.split('/');
    for (var i = 0; i < pathParts.length; i++) {
      data = data[pathParts[i]];
    }
    return data;
  }

  setTargetTemperature(zoneId, targetTemperature, setpoint, activity) {
    // zone 1 is at position 0 of the array
    const zoneArrayPosition = zoneId - 1;
    return this.getStatus().then(
      function (status) {
        const zone = status['zones'][0]['zone'].find(zone => zone['id'] === zoneId);

        if (!activity) {
          activity = zone['currentActivity'][0];
        }

        const uri = `/api/${zoneId}/activity/${activity}?${setpoint}=${targetTemperature} `;
        return this.refresh(uri);
      }.bind(this)
    );
  }

  setActivity(zoneId, activity, until) {
    let uri = `/api/${zoneId}/hold?activity=${activity}&until=${until}`;

    return this.refresh(uri);
  }

  removeHold(zoneId) {
    let uri = `/api/${zoneId}/hold?hold=off`;

    return this.refresh(uri);
  }

  async setSystemMode(mode) {
    let uri = `/api/config?mode=${mode}`;
    const systemMode = await this.getConfig('mode');
    if (systemMode !== mode) {
      return this.refresh(uri);
    }
  }
};
