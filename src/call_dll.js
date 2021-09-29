const ffi = require('ffi-napi');
const ref = require('ref-napi');
const Struct = require('ref-struct-napi');
const ConfigParser = require('configparser');

const LIB_LMB_API = '/opt/lanner/psp/bin/amd64/lib/liblmbapi.so';
const LIB_LMB_IO = '/opt/lanner/psp/bin/amd64/lib/liblmbio.so';

const HWM_CONF = '/opt/lanner/psp/bin/amd64/utils/hwm.conf';


const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


const isRoot = () => process.getuid && process.getuid() === 0;


String.form = function(str, arr) {
  var i = -1;
  function callback(exp, p0, p1, p2, p3, p4) {
    if (exp=='%%') return '%';
    if (arr[++i]===undefined) return undefined;
    exp  = p2 ? parseInt(p2.substr(1)) : undefined;
    var base = p3 ? parseInt(p3.substr(1)) : undefined;
    var val;
    switch (p4) {
      case 's': val = arr[i]; break;
      case 'c': val = arr[i][0]; break;
      case 'f': val = parseFloat(arr[i]).toFixed(exp); break;
      case 'p': val = parseFloat(arr[i]).toPrecision(exp); break;
      case 'e': val = parseFloat(arr[i]).toExponential(exp); break;
      case 'x': val = parseInt(arr[i]).toString(base?base:16); break;
      case 'd': val = parseFloat(parseInt(arr[i], base?base:10).toPrecision(exp)).toFixed(0); break;
    }
    val = typeof(val)=='object' ? JSON.stringify(val) : val.toString(base);
    var sz = parseInt(p1); /* padding size */
    var ch = p1 && p1[0]=='0' ? '0' : ' '; /* isnull? */
    while (val.length<sz) val = p0 !== undefined ? val+ch : ch+val; /* isminus? */
     return val;
  }
  var regex = /%(-)?(0?[0-9]+)?([.][0-9]+)?([#][0-9]+)?([scfpexd%])/g;
  return str.replace(regex, callback);
}


String.prototype.$ = function() {
  return String.form(this, Array.prototype.slice.call(arguments));
}

/**
 * Main.
 * @returns {null}
 */
const main = async () => {
  if (! isRoot()) {
    console.error('This script must be run as root!');
    return
  }

  let floatPtr = ref.refType(ref.types.float);
  let int8Ptr = ref.refType(ref.types.int8);
  let uint8Ptr = ref.refType(ref.types.uint8);
  let uint16Ptr = ref.refType(ref.types.uint16);
  let uint32Ptr = ref.refType(ref.types.uint32);
  let AXIS_RAWDATA = Struct({
    wXaxis: ref.types.int16,
    wYaxis: ref.types.int16,
    wZaxis: ref.types.int16,
    wgRange: ref.types.int16,
  });
  let pstuRawData = ref.refType(AXIS_RAWDATA);

  let liblmbio = ffi.Library(LIB_LMB_IO);
  let liblmbapi = ffi.Library(LIB_LMB_API, {
    'LMB_DLL_Init': [ref.types.int32, []],
    'LMB_DLL_DeInit': [ref.types.int32, []],
    'LMB_SLED_GetSystemLED': [ref.types.int32, [uint8Ptr]],
    'LMB_SLED_SetSystemLED': [ref.types.int32, [ref.types.uint8]],
    'LMB_SLED_SetGPSLED': [ref.types.int32, [ref.types.uint8]],
    'LMB_SLED_SetLteStateLED': [ref.types.int32, [ref.types.uint8]],
    'LMB_SLED_SetLteStressLED': [ref.types.int32, [ref.types.int8]],
    'LMB_HWM_GetCpuTemp': [ref.types.int32, [ref.types.uint8, floatPtr]],
    'LMB_HWM_GetSysTemp': [ref.types.int32, [ref.types.uint8, floatPtr]],
    'LMB_HWM_GetVcore': [ref.types.int32, [ref.types.uint8, floatPtr]],
    'LMB_HWM_Get12V': [ref.types.int32, [floatPtr]],
    'LMB_HWM_Get5V': [ref.types.int32, [floatPtr]],
    'LMB_HWM_Get3V3': [ref.types.int32, [floatPtr]],
    'LMB_HWM_Get5Vsb': [ref.types.int32, [floatPtr]],
    'LMB_HWM_Get3V3sb': [ref.types.int32, [floatPtr]],
    'LMB_HWM_GetVbat': [ref.types.int32, [floatPtr]],
    'LMB_HWM_GetVDDR': [ref.types.int32, [ref.types.int8, floatPtr]],
    'LMB_HWM_GetPowerSupply': [ref.types.int32, [ref.types.uint8, uint16Ptr]],
    'LMB_HWM_GetCpuFan': [ref.types.int32, [ref.types.uint8, uint16Ptr]],
    'LMB_HWM_GetSysFan': [ref.types.int32, [ref.types.uint8, uint16Ptr]],
    'LMB_RFM_GetModule': [ref.types.int32, [uint32Ptr]],
    'LMB_RFM_SetModule': [ref.types.int32, [ref.types.uint32]],
    'LMB_RFM_GetSIM': [ref.types.int32, [uint32Ptr]],
    'LMB_RFM_SetSIM': [ref.types.int32, [ref.types.uint32]],
    'LMB_GSR_GetAxisData': [ref.types.int32, [pstuRawData]],
    'LMB_GSR_GetAxisOffset': [ref.types.int32, [pstuRawData]],
    'LMB_GPS_SearchPort': [ref.types.int32, [int8Ptr]],
  });

  liblmbapi.LMB_DLL_Init();

  // ================================================================================
  // System LED (sdk/src_utils/sdk_sled/sdk_sled.c)
  // ================================================================================

  let ubRead = ref.alloc(ref.types.uint8, 0xFF);

  // Set system LED to green.
  liblmbapi.LMB_SLED_SetSystemLED(1);  // -1
  liblmbapi.LMB_SLED_GetSystemLED(ubRead);
  console.log(ubRead.deref());

  await sleep(1000);

  // Set system LED to red/amber.
  liblmbapi.LMB_SLED_SetSystemLED(2);
  liblmbapi.LMB_SLED_GetSystemLED(ubRead);
  console.log(ubRead.deref());  // 2

  await sleep(1000);

  // Set system LED to off.
  liblmbapi.LMB_SLED_SetSystemLED(0);
  liblmbapi.LMB_SLED_GetSystemLED(ubRead);
  console.log(ubRead.deref());

  // ================================================================================
  // GPS LED (sdk/src_utils/sdk_sled_gps/sdk_sled_gps.c)
  // ================================================================================

  // Set GPS LED to on.
  liblmbapi.LMB_SLED_SetGPSLED(1);

  await sleep(2000);

  // Set GPS LED to blink.
  liblmbapi.LMB_SLED_SetGPSLED(2);

  await sleep(2000);

  // Set GPS LED to off.
  liblmbapi.LMB_SLED_SetGPSLED(0);

  // ================================================================================
  // LTE LED (sdk/src_utils/sdk_sled_lte/sdk_sled_lte.c)
  // ================================================================================

  // Set LTE state LED to [red on, red blink, green on, green blink, yellow on, yellow blink].
  for (let i=1; i<7; i++) {
    liblmbapi.LMB_SLED_SetLteStateLED(0);  // Clear color.
    liblmbapi.LMB_SLED_SetLteStateLED(i);
    await sleep(2000);
  }

  // Set LTE state LED to off.
  liblmbapi.LMB_SLED_SetLteStateLED(0);

  // ================================================================================
  // LTE STRESS LED (sdk/src_utils/sdk_sled_lte_stress/sdk_sled_lte_stress.c)
  // ================================================================================

  // LTE stress LED show level [8 ~ 1].
  for (let i=90; i>5; i-=12) {
    liblmbapi.LMB_SLED_SetLteStressLED(i);
    await sleep(2000);
  }

  // Set LTE stress LED to off.
  liblmbapi.LMB_SLED_SetLteStressLED(-1);

  // ================================================================================
  // HWM (sdk/src_utils/sdk_hwm/sdk_hwm.c)
  // ================================================================================

  let ftemp = ref.alloc(ref.types.float);
  let wData = ref.alloc(ref.types.uint16);
  let wrpm = ref.alloc(ref.types.uint16);
  let min, max;

  const config = new ConfigParser();
  config.read(HWM_CONF);

  const str_replace = source => {
    let result = 1.0;
    source.split('*').forEach(element => {
      result *= parseFloat(element.trim());
    });
    return result;
  }

  /* Temperature. */
  // HWM_CPU1_Temp
  if (liblmbapi.LMB_HWM_GetCpuTemp(1, ftemp) === 0) {
    min = str_replace(config.get('HWM_CPU1_Temp', 'min'));
    max = str_replace(config.get('HWM_CPU1_Temp', 'max'));
    console.log('CPU-1 temperature = %3d C\t'.$(ftemp.deref()) +
                '(min = %3d C, max = %3d C)'.$(min, max));
  }
  // HWM_CPU2_Temp
  if (liblmbapi.LMB_HWM_GetCpuTemp(2, ftemp) === 0) {  // -5
    min = str_replace(config.get('HWM_CPU2_Temp', 'min'));
    max = str_replace(config.get('HWM_CPU2_Temp', 'max'));
    console.log('CPU-2 temperature = %3d C\t'.$(ftemp.deref()) +
                '(min = %3d C, max = %3d C)'.$(min, max));
  }
  // HWM_SYS1_Temp
  if (liblmbapi.LMB_HWM_GetSysTemp(1, ftemp) === 0) {
    min = str_replace(config.get('HWM_SYS1_Temp', 'min'));
    max = str_replace(config.get('HWM_SYS1_Temp', 'max'));
    console.log('SYS-1 temperature = %3d C\t'.$(ftemp.deref()) +
                '(min = %3d C, max = %3d C)'.$(min, max));
  }
  // HWM_SYS2_Temp
  if (liblmbapi.LMB_HWM_GetSysTemp(2, ftemp) === 0) {
    min = str_replace(config.get('HWM_SYS2_Temp', 'min'));
    max = str_replace(config.get('HWM_SYS2_Temp', 'max'));
    console.log('SYS-2 temperature = %3d C\t'.$(ftemp.deref()) +
                '(min = %3d C, max = %3d C)'.$(min, max));
  }

  /* Voltage. */
  // HWM_Core1_volt
  if (liblmbapi.LMB_HWM_GetVcore(1, ftemp) === 0) {
    min = str_replace(config.get('HWM_Core1_volt', 'min'));
    max = str_replace(config.get('HWM_Core1_volt', 'max'));
    console.log('CPU-1 Vcore = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_Core2_volt
  if (liblmbapi.LMB_HWM_GetVcore(2, ftemp) === 0) {
    min = str_replace(config.get('HWM_Core2_volt', 'min'));
    max = str_replace(config.get('HWM_Core2_volt', 'max'));
    console.log('CPU-2 Vcore = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_12v_volt
  if (liblmbapi.LMB_HWM_Get12V(ftemp) === 0) {
    min = str_replace(config.get('HWM_12v_volt', 'min'));
    max = str_replace(config.get('HWM_12v_volt', 'max'));
    console.log('12V = %7.3f V\t\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_5v_volt
  if (liblmbapi.LMB_HWM_Get5V(ftemp) === 0) {
    min = str_replace(config.get('HWM_5v_volt', 'min'));
    max = str_replace(config.get('HWM_5v_volt', 'max'));
    console.log('5V = %7.3f V\t\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_3v3_volt
  if (liblmbapi.LMB_HWM_Get3V3(ftemp) === 0) {
    min = str_replace(config.get('HWM_3v3_volt', 'min'));
    max = str_replace(config.get('HWM_3v3_volt', 'max'));
    console.log('3.3V = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_5vsb_volt
  if (liblmbapi.LMB_HWM_Get5Vsb(ftemp) === 0) {
    min = str_replace(config.get('HWM_5vsb_volt', 'min'));
    max = str_replace(config.get('HWM_5vsb_volt', 'max'));
    console.log('5VSB = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_3v3sb_volt
  if (liblmbapi.LMB_HWM_Get3V3sb(ftemp) === 0) {
    min = str_replace(config.get('HWM_3v3sb_volt', 'min'));
    max = str_replace(config.get('HWM_3v3sb_volt', 'max'));
    console.log('3.3VSB = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_vBat_volt
  if (liblmbapi.LMB_HWM_GetVbat(ftemp) === 0) {
    min = str_replace(config.get('HWM_vBat_volt', 'min'));
    max = str_replace(config.get('HWM_vBat_volt', 'max'));
    console.log('Vbat = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_vddr_volt
  if (liblmbapi.LMB_HWM_GetVDDR(1, ftemp) === 0) {
    min = str_replace(config.get('HWM_vddr_volt', 'min'));
    max = str_replace(config.get('HWM_vddr_volt', 'max'));
    console.log('VDDR = %7.3f V\t\t'.$(ftemp.deref()) +
                '(min = %7.3f V, max = %7.3f V)'.$(min, max));
  }
  // HWM_PSU1_volt
  if (liblmbapi.LMB_HWM_GetPowerSupply(1, wData) === 0) {
    min = str_replace(config.get('HWM_PSU1_volt', 'min'));
    max = str_replace(config.get('HWM_PSU1_volt', 'max'));
    console.log('PowerSupply 1 AC voltage = %3d V\t'.$(wData.deref()) +
                '(min = %3d V, max = %3d V)'.$(min, max));
  }
  // HWM_PSU2_volt
  if (liblmbapi.LMB_HWM_GetPowerSupply(2, wData) === 0) {
    min = str_replace(config.get('HWM_PSU2_volt', 'min'));
    max = str_replace(config.get('HWM_PSU2_volt', 'max'));
    console.log('PowerSupply 2 AC voltage = %3d V\t'.$(wData.deref()) +
                '(min = %3d V, max = %3d V)'.$(min, max));
  }

  /* Fan speed. */
  // HWM_CPU1_RPM
  if (liblmbapi.LMB_HWM_GetCpuFan(1, wrpm) === 0) {
    min = str_replace(config.get('HWM_CPU1_RPM', 'min'));
    max = str_replace(config.get('HWM_CPU1_RPM', 'max'));
    console.log('CPU FAN 1 speed = %5d rpm\t'.$(wrpm.deref()) +
                '(min = %5d rpm, max = %5d rpm)'.$(min, max));
  }
  // HWM_CPU2_RPM
  if (liblmbapi.LMB_HWM_GetCpuFan(2, wrpm) === 0) {
    min = str_replace(config.get('HWM_CPU2_RPM', 'min'));
    max = str_replace(config.get('HWM_CPU2_RPM', 'max'));
    console.log('CPU FAN 2 speed = %5d rpm\t'.$(wrpm.deref()) +
                '(min = %5d rpm, max = %5d rpm)'.$(min, max));
  }
  // HWM_SYS1_RPM
  if (liblmbapi.LMB_HWM_GetSysFan(1, wrpm) === 0) {
    min = str_replace(config.get('HWM_SYS1_RPM', 'min'));
    max = str_replace(config.get('HWM_SYS1_RPM', 'max'));
    console.log('SYS FAN 1 speed = %5d rpm\t'.$(wrpm.deref()) +
                '(min = %5d rpm, max = %5d rpm)'.$(min, max));
  }
  // HWM_SYS2_RPM
  if (liblmbapi.LMB_HWM_GetSysFan(2, wrpm) === 0) {
    min = str_replace(config.get('HWM_SYS2_RPM', 'min'));
    max = str_replace(config.get('HWM_SYS2_RPM', 'max'));
    console.log('SYS FAN 2 speed = %5d rpm\t'.$(wrpm.deref()) +
                '(min = %5d rpm, max = %5d rpm)'.$(min, max));
  }

  // ================================================================================
  // RFM (sdk/src_utils/sdk_rfm/sdk_rfm.c)
  // ================================================================================

  let udwReg = ref.alloc(ref.types.uint32, 0);

  // Set SIM status. (m.2: SIM1, mPCIE: SIM3)
  liblmbapi.LMB_RFM_SetSIM(0);
  // Get SIM status.
  liblmbapi.LMB_RFM_GetSIM(udwReg);
  console.log(udwReg.deref());

  // Set SIM status. (m.2: SIM2, mPCIE: SIM3)
  liblmbapi.LMB_RFM_SetSIM(1);
  // Get SIM status.
  liblmbapi.LMB_RFM_GetSIM(udwReg);
  console.log(udwReg.deref());

  // Set SIM status. (m.2: SIM1, mPCIE: SIM4)
  liblmbapi.LMB_RFM_SetSIM(2);
  // Get SIM status.
  liblmbapi.LMB_RFM_GetSIM(udwReg);
  console.log(udwReg.deref());

  // Set SIM status. (m.2: SIM2, mPCIE: SIM4)
  liblmbapi.LMB_RFM_SetSIM(3);
  // Get SIM status.
  liblmbapi.LMB_RFM_GetSIM(udwReg);
  console.log(udwReg.deref());

  // Set module status. (m.2: off, mPCIE: off)
  liblmbapi.LMB_RFM_SetModule(0);
  // Get module status.
  liblmbapi.LMB_RFM_GetModule(udwReg);
  console.log(udwReg.deref());

  // Set module status. (m.2: on, mPCIE: off)
  liblmbapi.LMB_RFM_SetModule(1);
  // Get module status.
  liblmbapi.LMB_RFM_GetModule(udwReg);
  console.log(udwReg.deref());

  // Set module status. (m.2: off, mPCIE: on)
  liblmbapi.LMB_RFM_SetModule(2);
  // Get module status.
  liblmbapi.LMB_RFM_GetModule(udwReg);
  console.log(udwReg.deref());

  // Set module status. (m.2: on, mPCIE: on)
  liblmbapi.LMB_RFM_SetModule(3);
  // Get module status.
  liblmbapi.LMB_RFM_GetModule(udwReg);
  console.log(udwReg.deref());

  // ================================================================================
  // GSR (sdk/src_utils/sdk_gsr/sdk_gsr.c)
  // ================================================================================

  let stuRawData = new AXIS_RAWDATA();

  let fXmg, fYmg, fZmg, fmgstep;

  // Get accel data.

  liblmbapi.LMB_GSR_GetAxisData(stuRawData.ref());
  console.log('stuRawData.wRange= ±%dg'.$(stuRawData.wgRange));

  switch (stuRawData.wgRange) {
    case 2:
      fmgstep = 2 / 255;
      break;
    case 4:
      fmgstep = 4 / 255;
      break;
    case 8:
      fmgstep = 8 / 255;
      break;
    case 16:
      fmgstep = 16 / 255;
      break;
  }

  fXmg = stuRawData.wXaxis * fmgstep;
  fYmg = stuRawData.wYaxis * fmgstep;
  fZmg = stuRawData.wZaxis * fmgstep;

  console.log('Raw=%d\t, X-Axis= %03.8f'.$(stuRawData.wXaxis, fXmg));
  console.log('Raw=%d\t, Y-Axis= %03.8f'.$(stuRawData.wYaxis, fYmg));
  console.log('Raw=%d\t, Z-Axis= %03.8f'.$(stuRawData.wZaxis, fZmg));

  // Get offset.

  liblmbapi.LMB_GSR_GetAxisOffset(stuRawData.ref());
  console.log('Offset X-Axis=%d'.$(stuRawData.wXaxis));
  console.log('Offset Y-Axis=%d'.$(stuRawData.wYaxis));
  console.log('Offset Z-Axis=%d'.$(stuRawData.wZaxis));

  // ================================================================================
  // GPS (sdk/src_utils/sdk_gps/sdk_gps.c)
  // ================================================================================

  const DEFAULT_GPSPORT = '/dev/ttyS1';
  let strGPSPort = ref.allocCString(DEFAULT_GPSPORT);
  liblmbapi.LMB_GPS_SearchPort(strGPSPort);
  console.log('--> LMB_GPS_SearchPort OK, port=%s'.$(ref.readCString(strGPSPort, 0)));

  // ================================================================================

  liblmbapi.LMB_DLL_DeInit();
}

main();
