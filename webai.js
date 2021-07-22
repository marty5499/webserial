/* eslint-disable */
class Port {

  async init() {
    const serial = navigator.serial;
    const filter = { usbVendorId: 6790 };
    this.serialPort = await serial.requestPort({ filters: [filter] });
    //const speed = 1000000
    const speed = 115200 * 1
    await this.serialPort.open({
      baudRate: speed,
      bufferSize: 1 * 1024 * 1024
    });
    this.textEncoder = new TextEncoder();
  }

  async openReader() {
    this.reader = await this.serialPort.readable.getReader()
    return this.reader
  }

  async releaseReader() {
    this.reader.releaseLock()
  }

  async openWriter() {
    this.writer = await this.serialPort.writable.getWriter()
    return this.writer
  }

  async releaseWriter() {
    this.writer.releaseLock()
  }

  async writeLine(data) {
    var uint8array = this.textEncoder.encode(data + "\r\n");
    await this.writer.write(uint8array)
  }

  async restart() {
    await this.serialPort.setSignals({ dataTerminalReady: false });
    await new Promise(resolve => setTimeout(resolve, 200));
    await this.serialPort.setSignals({ dataTerminalReady: true });
  }

  readLine(buf) {
    var text = ''
    for (var i = 0; i < buf.length; i++) {
      text += String.fromCharCode(buf[i])
      if (buf[i] == 0x0a) {
        break
      }
    }
    buf = buf.subarray(i + 1);
    return { text: text, buf: buf }
  }

  monitorRead(timeout) {
    var self = this
    setTimeout(function () {
      console.log("monitorRead --> readyToRead:", self.readyToRead)
      if (!self.readyToRead) {
        console.log("read failure !!");
        //self.serialPort.setSignals({ 'break': true });
      }
    }, timeout)
  }

  async readByteArray() {
    this.readyToRead = false
    //this.monitorRead(timeout);
    //console.log("read len")
    var { value, done } = await this.reader.read();
    var { text, buf } = this.readLine(value)
    var bufSize = parseInt(text)
    var data = new Uint8Array(bufSize)
    //console.log("text:", text, " ,buf:", buf.length,",data:",buf)
    try {
      data.set(buf, 0)
    } catch (e) {
      throw ("text:" + text + " ,buf:" + buf.length)
    }
    var readSize = buf.length
    while (readSize < bufSize) {
      //console.log("try to read...")
      await new Promise(r => setTimeout(r, 20));
      //this.monitorRead(timeout);
      var { value, done } = await this.reader.read();
      data.set(value, readSize)
      readSize += value.length
      //console.log("progress:", readSize , '/', bufSize)
    }
    this.readyToRead = true
    return data
  }
}


class WebAI {

  constructor() {
    window._webai_msg = [];
  }

  updateMsg(msg) {
    window._webai_msg.push(String(msg));
  }

  async requestSerialPort() {
    try {
      this.updateMsg('requestSerialPort');
      this.port = new Port()
      await this.port.init()
      await this.port.openReader()
      await this.port.openWriter()
      await webai.clearBuf()
      await webai.fetchPatchCode('patch.py')
    } catch (e) {
      this.updateMsg(e);
    }
  }

  async clearBuf() {
    var rtnStr = ''
    do {
      rtnStr = await webai.exec("print('_CLEAR_OK_')",100)
    } while (rtnStr.length != 12 || rtnStr != '_CLEAR_OK_\r\n')    
  }

  async fetchPatchCode(patchFileURL) {
    const response = await fetch(patchFileURL);
    var code = await response.text();
    await webai.exec(code)
  }

  async restart() {
    await this.port.restart()
    //*/
    await new Promise(r => setTimeout(r, 3200));
    var w = await this.port.serialPort.writable.getWriter()
    var ctrl_C = new Uint8Array([0x03])
    for (var i = 0; i < 10; i++) {
      console.log("ctrl+c", i)
      await w.write(ctrl_C)
      console.log("ctrl+c...ok")
      await new Promise(r => setTimeout(r, 100));
    }
    w.releaseLock()
    await this.port.initIO()
    //*
    await this.cmd('import lcd')
    await this.cmd('lcd.init()')
    await this.cmd('lcd.draw_string(50,100,"USB connect successful.")')
    //*/
  }

  async exec(code,respTimeout) {
    try {
      if(respTimeout==null){
        respTimeout = 20
      }
      this.updateMsg(code);
      await this.port.writeLine("execREPL");
      await this.port.writeLine(code.length);
      await this.port.writeLine(code)
      var rtnInfo = ''
      do {
        await this.waitForSerialPort(respTimeout)
        var { value, done } = await this.port.reader.read();
        var buf = value
        do {
          var { text, buf } = this.port.readLine(buf)
          rtnInfo = rtnInfo + text
        } while (buf.length > 0)
      } while (rtnInfo.indexOf("_REPL_OK_") == -1)
      var trimPos = rtnInfo.indexOf("_REPL_OK_")
      rtnInfo = rtnInfo.substring(0,trimPos)
      await this.waitForSerialPort(50)
      this.updateMsg(rtnInfo);
      return rtnInfo
    } catch (e) {
      this.updateMsg(e);
      console.log(e)
    }
  }

  async waitForSerialPort(t){
    await new Promise(resolve => setTimeout(resolve, t));
  }

  async cmd(cmd) {
    try {
      cmd = cmd + "\r\n"
      this.updateMsg(cmd);
      await this.port.writer.write(cmd);
      var { value, done } = await this.port.reader.read();
      var { text, buf } = this.port.readLine(value)
      console.log("resp:", text);
      this.updateMsg(text);
      return text
    } catch (e) {
      this.updateMsg(e);
    }
  }

  async readBreak() {
    await this.port.serialPort.setSignals({ 'break': true })
  }

  async readyToRead() {
    return this.port.serialPort.readyToRead
  }

  async getWiFiList() {
    var data = await this.exec("print(webai.esp8285.at('AT+CWLAP'))")
    return this.parseWiFiList(data)
  }

  async parseWiFiList(data) {
    data = data.replace(/(?:\\[rn]|[\r\n]+)+/g, "");
    var reg = /\(.[^\)]+\)/gm
    var result = [];
    var ele =''
    while ((ele = reg.exec(data)) !== null) {
      ele = ele[0].replace("(", "[").replace(")", "]")
      if (ele.indexOf("\\x") > 0) continue
      var row = JSON.parse(ele)
      if (row[1] == '') continue
      result.push(row[1])
    }
    return result
  }

  async cmd_mem() {
    await this.port.writeLine("mem");
    var { value, done } = await this.port.reader.read();
    var rtn = this.port.readLine(value)
    var string = new TextDecoder().decode(rtn.buf);
    console.log(rtn.text, '[', string, ']')
    return rtn.text
  }

  async cmd_deviceID() {
    await this.port.writeLine("deviceID");
    var { value, done } = await this.port.reader.read();
    var { text, buf } = this.port.readLine(value)
    return text
  }

  async cmd_snapshot() {
    var imgData = new Uint8Array(0)
    await this.port.writeLine("snapshot");
    var value = await this.port.readByteArray()
    return new Blob([value], { type: "image/jpeg" });
  }

  async cmd_flashRead(addr, size) {
    await this.port.writeLine("flashRead");
    await this.port.writeLine(addr + "," + size);
    return await this.port.readByteArray()
  }

  async cmd_flashWrite(addr, data) {
    await this.port.writeLine("flashWrite");
    await this.port.writeLine(addr + "," + data.length);
    await this.port.writer.write(data)
    var { value, done } = await this.port.reader.read();
    return new TextDecoder().decode(value)
  }
}

const webai = new WebAI()