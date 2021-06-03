import KPU as kpu
kpu.memtest()


webai.cfg.put('wifi',{'ssid':'KingKit_2.4G','pwd':'webduino'})

print(webai.cfg.get('wifi'))

#查看是否有設定wifi
webai.cfg.get('wifi') == None

#查看目前是否有wifi連線
webai.esp8285.wifiConnect
# True or False


# wifi 韌體版本
print(webai.esp8285.ver)
#0.1.6_0529_01

# k210 韌體版本
print(webai.ver)
print(webai.deviceID)


#列出 wifi
print(webai.esp8285.at('AT+CWLAP'))


