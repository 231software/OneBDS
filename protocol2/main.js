/**插件名 */
const PLUGIN_NAME="OneBDS"
/**协议版本 */
const PROTOCOL=2;
const LEWSS_PROTOCOL=1;

const JsonFile=require(".\\JsonFile.js")
const Listener=require(".\\listenAPI.js")

const conf=new JsonFile("plugins\\"+PLUGIN_NAME+"\\config.json");
conf.init("sync_port",{
    address:{
        host:"[::1]",
        port:6848
    }
})
conf.init("cuid",system.randomGuid())
conf.init("token","")
//组名
conf.init("group_name","default")

let EventLibrary={};
let connection_verified=false;

//收到任何消息都会触发这个
const recieveEvent=new Listener("onOneBDSRecieve")
//只有收到非自己端发送的消息才会触发这个
const recieveSyncEvent=new Listener("onOneBDSRecieveSync")
/**OneBDS断开连接时触发 */
const connectionLostEvent=new Listener("onOneBDSConnectionLost");
/**OneBDS连接成功时触发 */
const connectionOpenEvent=new Listener("onConnectionOpenEvent");
Listener.init(PLUGIN_NAME)

//////////////////////网络部分////////////////////////////////////
//这里的心跳等等重连需要写类似监听，把可以自定义的部分独立出去
const WebSocket_module = require("ws");
let wsconnection = undefined;
let connectionState=false;
/**
 * 由于开机时首先要创建一个连接，此处为false
 */
let disconnected=false;
newWSConnection()
let heartbeat=setInterval(()=>{
    function reconnect(){
        if(connectionState&&!disconnected){
            //因为连接断开了，所以这个时候把connection_verified设置为false，重连的时候要重新验证连接
            connection_verified=false;
            logger.warn("连接已断开，正在尝试重连")
            connectionState=false;
        }
        newWSConnection()
    }
    if(disconnected==true){
        //连接是被主动断开的，不重连
        //如果现在有连接就把连接断开
        if(wsconnection!=undefined)if(wsconnection.readyState==1)disconnect();
        return;
    }
    if(wsconnection==undefined){
        //连接自身为undefined，必须首先且单独判断
        //console.log("undefined")
        reconnect();
        return;
    }
    if(wsconnection.readyState==3){
        //连接状态为3，应该是断开了连接并等待连接
        //console.log("3")
        reconnect();
        return;
    }
    //正常连接部分，什么也不做
    //console.log(wsconnection.readyState.toString())
},1000)
function newWSConnection(){
    /**连接地址 */
    let url='ws://'+conf.get("sync_port").address.host+":"+conf.get("sync_port").address.port;
    if(conf.get("token").length!=0)url=url+"?key="+conf.get("token");
    //更新wsconnection
    wsconnection=new WebSocket_module(url);
    //解除主动断开状态
    disconnected=false;
    wsconnection.on("error",()=>{});
    //wsconnection.on("close",(param)=>{console.log("连接被关闭,显示"+param.toString())})
    wsconnection.on("open",()=>{     
        //连接开启的时候需要验证连接，所以不能在这个时候设置connection_verified   
        online_status=true;
        connectionOpenEvent.exec();
        logger.info("成功连接至LLSE-ExpressWebSocketServer");
        connectionState=true;
        join();
    })
    wsconnection.on("message",message)
}
function disconnect(){
    wsconnection.close()
    disconnected=true;
}
//此部分代码在chatwss网络控制部分基础上修改
/*
const WebSocket = require('ws');
let online_status=false;
var ws;
setTimeout(wsctrl,3000);
function wsctrl(){
    ws=new WebSocket('ws://'+conf.get("sync_port").address.host+":"+conf.get("sync_port").address.port);
    heartbeat();
    //log("连接中")
    ws.on("error",()=>{
        //log("无法连接")
    });//?
    ws.on('open', ()=>{
        online_status=true;
        connectionOpenEvent.exec();
        logger.info("成功连接至OneBDS节点")
        join();
    });
    //连接成功后收到任何数据都会触发这个
    ws.on('message', recieveMessage);
}
//来自WS协调服务端
function heartbeat(){
    setInterval(() => {
        let wsc = ws;

        if (wsc == undefined){
            rec(wsc);
            return;
        }else if(wsc.readyState == 3){
            wsc.close();
            wsc = undefined;
            rec(wsc);
        }
        function rec(wsc){
            //log("即将重新连接")
            if(online_status){
                online_status=false;
                connectionLostEvent.exec();
                logger.warn("与OneBDS网络通讯断开，正在尝试重连")
            }
            wsctrl()
        }
        
    },1500);
}

function closeConnection(){
    ws.close();
}*/
///////////////////////////////////////////////////////////////

mc.listen("onServerStarted",()=>{
    //由于协议1是依靠LLSE-ExpressWebSocketServer运行的，所以如果自己所在服务器装这个插件了就直接把自己设置为通过验证
    if(ll.listPlugins().includes("LLSE-ExpressWebSocketServer")){
        //和lewss共存则验证已弃用
        //connection_verified=true;
    }
})

/*
插件如果想接入onebds，他提供自己的插件名即可
先调用OneBDS的接口告诉OneBDS自己的插件名
之后OneBDS先在内部根据这个插件名创建事件
然后OneBDS会把事件名返回给插件
跟PlayerEntranceEvent是一样的
*/

function join() {
    sendGetLEWSSProtocol();
}

/**
 * 通过框架发送数据
 * @param {string} plugin_name 插件名，因为ll的函数导出不能判断是哪个插件调用了函数所以必须每次都传入
 * @param {object} data 要发送的数据
 */
async function pluginSend(plugin_name,data){
    if(!connection_verified)return;
    wsconnection.send("<"+PLUGIN_NAME+"><"+PROTOCOL+"><send><"+conf.get("cuid")+">"+JSON.stringify({
        type:"send",
        clientID:conf.get("cuid"),
        plugin_name,
        data
    }))
}
ll.exports(pluginSend,PLUGIN_NAME,"send")

async function sendGetLEWSSProtocol(){
    wsconnection.send("<LEWSS><1>")
}

async function sendGetLEWSSClients(){
    wsconnection.send("<LEWSS><1><clients>"+JSON.stringify({
        group:"default"
    }))
}

async function sendGetProtocol(){
    wsconnection.send("<"+PLUGIN_NAME+">"+JSON.stringify({
        type:"get protocol",
        clientID:conf.get("cuid"),
    }))
}

async function sendReplyProtocol(sender){
    wsconnection.send("<"+PLUGIN_NAME+">"+JSON.stringify({
        type:"reply protocol",
        clientID:conf.get("cuid"),
        sender,
        protocol:PROTOCOL
    }))
}

async function sendJoin(){
    wsconnection.send("<"+PLUGIN_NAME+"><"+PROTOCOL+"><join><"+conf.get("cuid")+">")
}

/**
 * ws收到数据流时执行的函数
 * @param {Buffer} dataRaw 收到的数据流
 */
function message(dataRaw) {
    data=dataRaw.toString()
    //通过头部的"<OneBDS>"判断是否为OneBDS发送来的消息
    if(!data.startsWith("<"+PLUGIN_NAME+">")){
        //如果不是OneBDS则执行其他协议的判断
        //这部分只写if和else if
        if(data.startsWith("<LEWSS>")){
            //LEWSS协议
            data=data.replace("<LEWSS>","");
            if(!data.startsWith("<"+LEWSS_PROTOCOL+">")){
                //LEWSS回复了和自己协议不同的包，证明协议不同，直接退出
                logger.error("正在连接到的LEWSS不是本插件要求的LEWSS协议。本插件要求的LEWSS协议为"+LEWSS_PROTOCOL+"。")
                exit();
                return;
            }
            data=data.replace("<"+LEWSS_PROTOCOL+">","");
            if(data.length==0){
                //后面没有任何消息，证明lewss没有解析协议
                logger.error("正在连接到的LEWSS版本过旧，请将其升级至0.1及以上版本再试。")
                exit();
                return;
            }
            //此处的解析包种类后面都没有带return，目前return在整个非onebds协议解析部分的末尾执行
            //此处只能写if和else if
            if(data.startsWith("<accept>")){
                //收到accept回复证明自己已被批准加入LEWSS，可以继续执行了
                sendGetLEWSSClients();
            }
            else if(data.startsWith("<clients>")){
                //收到clients的回复
                data=data.replace("<clients>","");
                let dataObj=JSON.parse(data);
                if(dataObj.group=="default"){
                    if(dataObj.amount>=2){
                        sendGetProtocol();
                    }
                    else{
                        //此时群组中没有任何服务端，他是第一个来的，所以直接向自己发送加入包
                        connection_verified=true;
                        sendJoin();
                    }
                }

            }
        }
        return;
    }
    //此处已验证为头部匹配<OneBDS>，开始走OneBDS协议的解析
    //只能写if else if
    data=data.replace("<"+PLUGIN_NAME+">","");
    if(data.startsWith("{")){
        //以花括号开头的是json，证明是onebds1的协议认证
        /**这是将以二进制发送的纯文本消息中的json转为了字符串然后parse成对象，后面就可以直接访问里面的数据了 */
        let dataobj=JSON.parse(data);
        //发送消息的种类为send，证明这是有插件正在向其他插件发送消息
        switch(dataobj.type){
            /*
            case "send":{
                if(!connection_verified)break;
                if(EventLibrary[dataobj.plugin_name]==undefined){
                    logger.warn("收到插件"+dataobj.plugin_name+"的数据，但是该插件在当前端未正确安装！")
                    break;
                }
                //send对应receive，如果收到send了一定触发这个receive
                recieveEvent.exec(dataobj.data);
                EventLibrary[dataobj.plugin_name].RecieveEvent.event.exec(dataobj.data)
                //此处过滤掉本端发送的消息，用另一个事件会导致插件自己收到自己发的消息
                if(dataobj.clientID!=conf.get("cuid")){
                    recieveSyncEvent.exec(dataobj.data);
                    EventLibrary[dataobj.plugin_name].RecieveSyncEvent.event.exec(dataobj.data)
                }
                break;
            }
            case "join":{
                if(dataobj.protocol!=PROTOCOL){
                    logger.fatal("服务端"+dataobj.clientID+"与此组网的协议不匹配，但仍然加入了此OneBDS网络：\n当前协议："+PROTOCOL+"，刚刚加入的服务端使用的协议："+dataobj.protocol);
                    break;
                }
                logger.info("一个新的OneBDS服务端加入了群组，cuid："+dataobj.clientID);
                break;
            }
            */
            case "get protocol":{
                sendReplyProtocol(dataobj.clientID);
                break;
            }
            case "reply protocol":{
                //必须发送者不是自己且请求者（sender）是自己，此外如果连接已经被验证了就不用解析了
                if(dataobj.clientID==conf.get("cuid")||dataobj.sender!=conf.get("cuid")||connection_verified)break;
                //暂时只以收到的第一个为准
                if(dataobj.protocol==PROTOCOL){
                    connection_verified=true;
                    sendJoin();
                }
                else{
                    //协议不匹配
                    //三个服务端及以上的时候会有出现两个这个提示
                    logger.error("当前服务端使用的协议与目标组网协议不一致。\n当前协议："+PROTOCOL+"，组网协议："+dataobj.protocol)
                    exit();
                }
                break;
            }
        }         
    }
    else if(data.startsWith("<")){
        //OneBDS2及以上的协议
        if(!data.startsWith("<"+PROTOCOL+">")){
            //协议不正确
            logger.error("数据包协议错误。")
            return;
        }
        data=data.replace("<"+PROTOCOL+">","");
        //解析包种类
        let pktType=data.match(/<(.+?)>/)[1]
        data=data.replace("<"+pktType+">","")
        //解析cuid
        let senderCUID=data.match(/<(.+?)>/)[1]
        data=data.replace("<"+senderCUID+">","")
        //解析json
        let dataObj={}
        if(data.length!=0){
            dataObj=JSON.parse(data)
        }
        switch(pktType){
            case "join":{
                logger.info("一个新的OneBDS服务端加入了群组，cuid："+senderCUID);
                break;
            }
            case "send":{
                log(dataObj)
                break;
            }
        }
            
    }
    else{
        logger.error("收到无法解析的数据包："+data);
        return;
    }
}

/**
 * 在OneBDS系统中注册插件
 * @param {string} plugin_name 插件名
 * @returns {boolean} 事件名前缀（后面仍然需要自己用字符串拼接补全）
 */
function register(plugin_name){
    const eventNameFormat=PLUGIN_NAME+", plugin name: "+plugin_name+", eventID: "+system.randomGuid()+" event name: "
    const newRecieveEvent=new Listener(eventNameFormat+"RecieveEvent");
    const newRecieveSyncEvent=new Listener(eventNameFormat+"RecieveSyncEvent");
    //初始化插件
    if(EventLibrary[plugin_name]==undefined)EventLibrary[plugin_name]={};
    //刷新插件在事件库中的各个事件实例
    EventLibrary[plugin_name].RecieveEvent={
        name:eventNameFormat+"RecieveEvent",
        event:newRecieveEvent
    }
    EventLibrary[plugin_name].RecieveSyncEvent={
        name:eventNameFormat+"RecieveSyncEvent",
        event:newRecieveSyncEvent
    }
    return eventNameFormat;
}
ll.exports(register,PLUGIN_NAME,"register")

function selfUnload(){
    mc .runcmdEx("ll unload "+PLUGIN_NAME);
}
function exit(){
    //让ws断开连接
    disconnect();
    //卸载自身
    selfUnload();
}

ll.exports(()=>{return conf.get("cuid")},PLUGIN_NAME,"getcuid");
ll.exports(()=>{return conf.get("group_name")},PLUGIN_NAME,"getGroupName");
ll.exports(()=>{return online_status},PLUGIN_NAME,"isOnline")
ll.exports(()=>{return PROTOCOL},PLUGIN_NAME,"getProtocol")

const llversion = ll.requireVersion(2,9,2)?[2,0,0,Version.Dev]:[2,0,0]
ll.registerPlugin(PLUGIN_NAME, "OneBDS-LLSE插件集线器", llversion,{Author:"New Moon Minecraft Studio"});