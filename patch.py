def xxx1(x,y,text,clear):
    pass

def xxx2():
    while not cmdSerial.repl.any():
        pass
    recv = cmdSerial.repl.readline()
    recv = recv.decode("utf-8").rstrip()
    return recv

def xxx3(repl):
    info = cmdSerial.readLine()
    readLen = int(info)
    while not cmdSerial.repl.any():
        pass
    data = repl.read(int(readLen))
    data = data.decode("utf-8").rstrip()
    try:
        exec(data)
    except Exception as e:
        print("exec(...) err:",e)
    print("_REPL_OK_")
    info = None
    readLen = None
    data = None
    time.sleep(0.01)
    gc.collect()
    while cmdSerial.repl.any():
        cmdSerial.repl.read(1)

cmdSerial.print = xxx1
cmdSerial.readLine = xxx2
cmdSerial.execREPL = xxx3

'''
from webai import *
webai.init(camera=False,speed=10)
webai.esp8285.uart_cb = UART(UART.UART3, 115200,timeout=5000,read_buf_len=10240,callback=webai.esp8285.mqttCallback)
webai.mqtt.sub('PING',webai.cmdProcess.sub,includeID=True)
webai.cmdProcess.reportBoot()
'''