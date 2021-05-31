class Port {

  async init() {
    const serial = navigator.serial;
    this.serialPort = await serial.requestPort();
    //const speed = 1000000
    const speed = 115200*4
    await this.serialPort.open({
      baudRate: speed,
      bufferSize: 1 * 1024 * 1024
    });
    this.textEncoder = new TextEncoder();
  }

  async openReader(){
    this.reader = await this.serialPort.readable.getReader()
    return this.reader
  }

  async releaseReader(){
  	this.reader.releaseLock()
  }

  async openWriter(){
    this.writer = await this.serialPort.writable.getWriter()
    return this.writer
  }

  async releaseWriter(){
  	this.writer.releaseLock()
  }

  async writeLine(data){
  	var uint8array = this.textEncoder.encode(data+"\r\n");
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
      if (buf[i] == 0x0a) break
    }
    text = text.trim();
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

  async requestSerialPort() {
    this.port = new Port()
    await this.port.init()
    await this.port.openReader()
    await this.port.openWriter()
  }

  async restart() {
    await this.port.restart()
    //*/
    await new Promise(r => setTimeout(r, 3200));
    var w = await this.port.serialPort.writable.getWriter()
    var ctrl_C = new Uint8Array([0x03])
    for (var i = 0; i < 10; i++) {
      console.log("ctrl+c",i)
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

  async cmd(cmd){
  	cmd = cmd +"\r\n"
  	await this.port.writer.write(cmd);
    var { value, done } = await this.port.reader.read();
    var { text, buf } = this.port.readLine(value)
    console.log("resp:",text);
    return text
  }

  async readBreak() {
    await this.port.serialPort.setSignals({ 'break': true })
  }

  async readyToRead() {
    return this.port.serialPort.readyToRead
  }

  async cmd_clear() {
    await this.port.writeLine("clear");
    var { value, done } = await this.port.reader.read();
    var { text, buf } = this.port.readLine(value)
    return text
  }

  async cmd_mem() {
    await this.port.writeLine("mem");
    var { value, done } = await this.port.reader.read();
    var memInfo = ''
    var { text, buf } = this.port.readLine(value)
    memInfo += text + '\r\n'
    var { text, buf } = this.port.readLine(buf)
    memInfo += text + '\r\n'
    var { text, buf } = this.port.readLine(buf)
    memInfo += text + '\r\n'
    var { text, buf } = this.port.readLine(buf)
    memInfo += text + '\r\n'
    return memInfo
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

  async cmd_flashWrite(addr,data) {
    await this.port.writeLine("flashWrite");
    await this.port.writeLine(addr+","+data.length);
    await this.port.writer.write(data)
    var { value, done } = await this.port.reader.read();
    return new TextDecoder().decode(value)
  }


}

webai = new WebAI()