// This should be enough for most cases.
// Taken from another one of my projects: https://github.com/Milk-Cool/imp/blob/main/misc/validator.js

export default class Validator {
    /**
     * Constructs a new Validator.
     * 
     * @param {object} body Typically req.body or req.query
     */
    constructor(body) {
        this.body = body;
    }

    /**
     * Gets an object's value by path.
     * 
     * @param {string} path Path to the value
     * @returns {string | number | object | null} The value (or null if it doesn't exist)
     */
    getByPath(path) {
        let value = { ...this.body };
        for(const part of path.split(".")) {
            if(!(part in value))
                return null;
            value = value[part];
        }
        return value;
    }

    /**
     * Validates a string.
     * 
     * @param {string} path Path to the string (e. g. "other.country")
     * @param {{ optional?: boolean, min?: number, max?: number, regex?: RegExp }} [opts] Validation options
     * @returns {boolean} Whether the string is valid
     */
    str(path, opts = {}) {
        const value = this.getByPath(path);
        if("optional" in opts && opts.optional === true && value === null)
            return true;
        if(typeof value !== "string")
            return false;
        if("min" in opts && opts.min > value.length)
            return false;
        if("max" in opts && opts.max < value.length)
            return false;
        if("regex" in opts && !value.match(opts.regex))
            return false;
        return true;
    }

    /**
     * Validates an integer.
     * 
     * @param {string} path Path to the integer (e. g. "other.age")
     * @param {{ optional?: boolean, min?: number, max?: number, float?: boolean }} [opts] Validation options
     * @returns {boolean} Whether the integer is valid
     */
    int(path, opts = {}) {
        const value = this.getByPath(path);
        if("optional" in opts && opts.optional === true && value === null)
            return true;
        if(typeof value !== "number")
            return false;
        if(!("float" in opts) && Math.floor(value) !== value)
            return false;
        if("min" in opts && opts.min > value)
            return false;
        if("max" in opts && opts.max < value)
            return false;
        return true;
    }


    /**
     * Validates an integer represented as a string.
     * 
     * @param {string} path Path to the "strinteger" (e. g. "other.age")
     * @param {{ optional?: boolean, min?: number, max?: number }} [opts] Validation options
     * @returns {boolean} Whether the "strinteger" is valid
     */
    strint(path, opts = {}) {
        let value = this.getByPath(path);
        if("optional" in opts && opts.optional === true && value === null)
            return true;
        if(typeof value !== "string")
            return false;
        if(!value.match(/^[0-9]+$/))
            return false;
        value = parseInt(value);
        if("min" in opts && opts.min > value)
            return false;
        if("max" in opts && opts.max < value)
            return false;
        return true;
    }

    /**
     * Checks if all values are true.
     * 
     * @param {boolean[]} arr 1D array to check
     * @returns {boolean} Whether all values are true
     */
    static check(arr) {
        return !arr.some(x => !x);
    }
}