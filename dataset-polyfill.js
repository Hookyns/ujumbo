/*
 * Include this only if you want to support browsers older than IE11
 */

// Element.dataset back compatibility to IE9
if (!document.createElement("span")["dataset"]) {
	Object.defineProperty(Element.prototype, "dataset", {
		enumerable: true, // IE 8 doesn't support enumerable true
		get: function () {
			"use strict";
			var i, self = this, attrs = this.attributes, attrsl = attrs.length, pn;

			function toCamel(name) {
				return name.replace(/-./g, function (m) {
					return m.charAt(1).toUpperCase();
				});
			}

			var data = {}; // IE8 need element

			for (i = 0; i < attrsl; i++) {
				(function (attr) {
					if ((/^data-/).test(attr.name)) {
						pn = toCamel(attr.name.substr(5));

						Object.defineProperty(data, pn, {
							enumerable: true, // IE 8 doesn't support enumerable true
							get: function () {
								return attr.value;
							},
							set: function (value) {
								return (typeof value != "undefined") ?
									self.setAttribute(attr.name, value) :
									self.removeAttribute(attr.name);
							}
						});
					}
				})(attrs[i]);
			}

			return data;
		}
	});
}