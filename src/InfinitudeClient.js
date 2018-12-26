const axios = require('axios').create({
  timeout: 5000
});
const parser = require('fast-xml-parser');

module.exports = class InfinitudeClient {
  constructor(url, log) {
    this.url = url;
    this.log = log;

    this.xmlOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: ''
    };
  }

  async getStatus() {
    try {
      const response = await axios.get(`${this.url}/status.xml`);
      const statusJson = parser.convertToJson(
        parser.getTraversalObj(response.data, this.xmlOptions)
      );
      return statusJson;
    } catch (error) {
      this.log.error(error);
    }
  }

  updateTemperature(zoneId, targetTemperature, callback) {
    try {
      axios.get(`${this.url}/systems.json`).then(
        function(response) {
          const configJson = response.data;
          const zone = configJson['system'][0]['config'][0]['zones'][0][
            'zone'
          ].find(zone => zone['id'] === zoneId);
          const manual = zone['activities'][0]['activity'].find(
            activity => activity['id'] === 'manual'
          );
          manual['htsp'] = [Math.round(targetTemperature).toString() + '.0'];
          manual['clsp'] = [Math.round(targetTemperature).toString() + '.0'];
          axios
            .post(`${this.url}/systems/infinitude`, configJson)
            .then(function() {
              if (callback) callback(null);
            })
            .catch(
              function(error) {
                this.log.error(error);
                if (callback) callback(error);
              }.bind(this)
            );
        }.bind(this)
      );
    } catch (error) {
      this.log.error(error);
    }
  }

  setActivity(zoneId, activity, callback) {
    try {
      axios.get(`${this.url}/systems.json`).then(
        function(response) {
          const configJson = response.data;
          const zone = configJson['system'][0]['config'][0]['zones'][0][
            'zone'
          ].find(zone => zone['id'] === zoneId);
          zone['holdActivity'] = [activity];
          axios
            .post(`${this.url}/systems/infinitude`, configJson)
            .then(function() {
              if (callback) callback(null);
            })
            .catch(
              function(error) {
                this.log.error(error);
                if (callback) callback(error);
              }.bind(this)
            );
        }.bind(this)
      );
    } catch (error) {
      this.log.error(error);
    }
  }
};
