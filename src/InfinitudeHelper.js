module.exports = class InfinitudeHelper {
    constructor() { }

    fahrenheitToCelsius(temperature) {
        return (temperature - 32) * (5 / 9);
    }

    celsiusToFahrenheit(temperature) {
        return temperature * (9 / 5) + 32;
    }

    convertToInfinitude(temperature, scale) {
        let t = temperature;

        if (scale === 'F') {
            t = this.celsiusToFahrenheit(temperature);
        }

        return parseFloat(t).toFixed(1);
    }

    convertToHomeKit(temperature, scale) {
        let t = temperature;

        if (scale === 'F') {
            t = this.fahrenheitToCelsius(temperature);
        }

        return parseFloat(t).toFixed(1);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}