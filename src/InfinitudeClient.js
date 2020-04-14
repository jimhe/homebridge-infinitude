const axios = require('axios');
const parser = require('fast-xml-parser');

module.exports = class InfinitudeClient {
  static get REFRESH_MS() {
    return 10000;
  }

  constructor(url, holdUntil, log) {
    this.url = url;
    this.holdUntil = holdUntil;
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
    return this.refresh('/status.xml', response => {
      const json = parser.parse(response.data, this.xmlOptions);
      return json['status'];
    });
  }

  refreshSystems() {
    return this.refresh('/systems.json', response => response.data);
  }

  async getStatus() {
    if (this.cachedObjects['/status.xml'] === undefined) {
      await this.refreshStatus();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/status.xml']);
      }.bind(this)
    );
  }

  async getSystems() {
    if (this.cachedObjects['/systems.json'] === undefined) {
      await this.refreshSystems();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/systems.json']);
      }.bind(this)
    );
  }

  setTargetTemperature(zoneId, activity, targetTemperature, setpoint, callback) {
    // zone 1 is at position 0 of the array
    const zoneArrayPosition = zoneId - 1;

    return this.getSystems().then(
      function(systems) {
        const zone = systems['system'][0]['config'][0]['zones'][0]['zone'].find(zone => zone['id'] === zoneId);
        const activityIndex = zone['activities'][0]['activity'].findIndex(a => a['id'] === activity);
        const uri = `${this.url}/api/config/zones/zone/${zoneArrayPosition}/activities/activity/${activityIndex}?${setpoint}=${targetTemperature}`;
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

  setActivity(zoneId, activity, callback) {
    // zone 1 is at position 0 of the array
    const zoneArrayPosition = zoneId - 1;
    let uri = `${this.url}/api/config/zones/zone/${zoneArrayPosition}?holdActivity=${activity}&hold=on`;

    if (activity !== 'away' && this.holdUntil) {
      uri += `&otmr=${encodeURIComponent(this.holdUntil)}`;
    }

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
};
