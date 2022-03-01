define(['agda-rts' ,  "jAgda.Agda.Primitive" ],

function(agdaRTS ,  z_jAgda_Agda_Primitive ) {

var exports = {};

exports["⊤"] = {};
exports["⊤"]["tt"] = a => a["tt"]();
exports["JSN"] = undefined;
exports["JSR"] = undefined;
exports["runJS"] = _ => _ => f => { f(undefined) };
exports["jsInitInterface"] = rawjsInitInterface;
exports["onload"] = exports["runJS"](null)(null)(exports["jsInitInterface"]);

return exports; });
