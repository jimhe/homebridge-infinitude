module.exports = class InfinitudeLog {

    constructor(logger, verbose) {
        this.logger = logger;
        this.verboseLogging = verbose;
    }

    verbose(message, parameters = []) {
        if (this.verboseLogging) {
            parameters.length > 0 ? this.logger.info(`[VERBOSE] ${message}`, parameters) : this.logger.info(`[VERBOSE] ${message}`);
        }
    }

    info(message, parameters = []) {
        parameters.length > 0 ? this.logger.info(message, parameters) : this.logger.info(message);
    }

    warn(message, parameters = []) {
        parameters.length > 0 ? this.logger.warn(message, parameters) : this.logger.warn(message);
    }

    error(message, parameters = []) {
        parameters.length > 0 ? this.logger.error(message, parameters) : this.logger.error(message);
    }

    debug(message, parameters = []) {
        parameters.length > 0 ? this.logger.debug(message, parameters) : this.logger.debug(message);
    }

    log(logLevel, message, parameters = []) {
        parameters.length > 0 ? this.logger.log(logLevel, message, parameters) : this.logger.log(logLevel, message);
    }
}