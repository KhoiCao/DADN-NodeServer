var mqtt = require('mqtt');
var firebase = require('firebase');
var cron = require('cron');

// const firebaseConfig = {
//   apiKey: 'AIzaSyADawFZYkBiSUoh5bdWpescXF0V2DvDvvk',
//   authDomain: 'lightappdemo-dc252.firebaseapp.com',
//   databaseURL: 'https://lightappdemo-dc252.firebaseio.com',
//   projectId: 'lightappdemo-dc252',
//   storageBucket: 'lightappdemo-dc252.appspot.com',
//   messagingSenderId: '670980151251',
//   appId: '1:670980151251:web:245ac428bec24de86a0126',
// };

const firebaseConfig = {
  apiKey: "AIzaSyC7Uz_Eh4UV3xNNWsK5zVtsBsKi6tILI4A",
  authDomain: "dadn-db-27210.firebaseapp.com",
  databaseURL: "https://dadn-db-27210.firebaseio.com",
  projectId: "dadn-db-27210",
  storageBucket: "dadn-db-27210.appspot.com",
  messagingSenderId: "1025118247898",
  appId: "1:1025118247898:web:02930c9ce787a0327e7ee3"
};

var app = firebase.initializeApp(firebaseConfig);


var options = {clientID: "181as09123", clean: true };

var client = mqtt.connect("mqtt://52.230.26.121",options)

client.on("connect",function(){
	console.log("connected to mqtt broker");
});

client.on("error",function(error){
	console.log("error: " + error);
});


client.subscribe("Topic/Light");

client.on("message",function(topic,message,packet){
	console.log("message: " + message + " from topic: " + topic);
	updateDBAndPublish(message);
});

let timingObj;
let timingList = [];
let timerJobList = [];
let deviceList = [];
let deviceListObj;
let indexInRoom = [];
let controlList = [];

function readRoomData () {
	firebase
		.database()
		.ref('roomList')
		.on('value', (snapshot) =>{
			roomList = [];
			roomList = [...snapshot.val()];
			// console.log(roomList);
		});
}
function readTimingData(){
		firebase
		.database()
		.ref('timingList')
		.on('value', (snapshot) =>{
			// timingObj = snapshot.val();
			stopAllJob();
			createTimer(snapshot.val());
		});
}
function readDeviceData(){
	firebase
	.database()
	.ref('deviceList')
	.on('value',(snapshot)=>{
		deviceListObj = snapshot.val();
		console.log(deviceListObj);
		createDeviceList(deviceListObj);
		// createDeviceList(snapshot.val());

	});
}

function readControlData(){
	firebase
	.database()
	.ref('controlList')
	.on('value',(snapshot)=>{
		controlList = snapshot.val();
		console.log(controlList);
	});
}

// readRoomData();
readDeviceData();
readTimingData();
readControlData();

function createDeviceList(deviceListObj){
	deviceList = [];
	for (let i in deviceListObj){
		deviceInRoom = deviceListObj[i].map((device,index) => ({...device, room: i,indexInRoom: index}));
		deviceList = deviceList.concat(deviceInRoom);
	}
	deviceList.sort((a,b)=>(+a.deviceID - +b.deviceID));
	console.log(deviceList.sort((a,b)=>(+a.deviceID - +b.deviceID)));
}

function createTimer(timingObj){
	let i;
	timingList = [];
	for (i in timingObj){
		timingInRoom = timingObj[i].map((timing) => ({...timing, room: i}));
		timingList = timingList.concat(timingInRoom);
	}
	// console.log(timingList.length);
	createJob(timingList);
}

// function publishMessage(mess){
// 	client.publish("Topic/LightD",mess,{retain:false, qos:0});
// }
// var mess = "Wake Up";
// var job = new cron.CronJob('00 40 21 * * *', function() {
//   publishMessage(mess);
// }, null, false, 'Asia/Ho_Chi_Minh');
// job.start();

function createJob(timingList){
	for(let i = 0; i < timingList.length; i++){
		let days = timingList[i].day;
		let deviceId = timingList[i].deviceID;
		let deviceName = timingList[i].deviceName;
		let action = timingList[i].off;
		let time = timingList[i].time;
		let room = timingList[i].room;
		let triggerTime = time.split(':');
		let setDays = '';
		let deviceIndex;
		// console.log(time);
		for (day in days){
			if(days[day]) setDays += `${convertDayToNum(day)},`;
		}
		setDays = setDays.slice(0,setDays.length - 1);
		// console.log(setDays);
		let messageObj = {device_id: deviceId.toString(), values:[(action? "0" : "1"),"255"]};
		let message = [];
		message.push(messageObj);
		// console.log(JSON.stringify(message));

		for (roomDevices in deviceListObj){
			if (roomDevices === room){
				let devices = deviceListObj[roomDevices];
				for (let i = 0; i < devices.length; i++){
					if (devices[i].deviceID === deviceId){
						deviceIndex = i;
					}
				}
			}
		}

		let job = new cron.CronJob(`00 ${triggerTime[1]} ${triggerTime[0]} * * ${setDays}`,function(){
			client.publish("Topic/LightD",JSON.stringify(message),{retain:false, qos:0});
			let today = new Date();
		  	let dd = today.getDate();
		  	let mm = today.getMonth() + 1;
		  	let yyyy = today.getFullYear();
		  	let hh = today.getHours();
		  	let min = today.getMinutes();
		  	let formattedDate = dd + '-' + mm + '-' + yyyy;
			setUpForLog(formattedDate, deviceName, deviceId, room, time, action);
			changeDeviceState(deviceIndex, room, !action);
			// let written = writeToLog(deviceName, deviceId, room, time, action, true, numChild);
			// if(written) console.log("written to log");
		}, null, false, 'Asia/Ho_Chi_Minh');
		job.start();
		timerJobList.push(job);
	}
	// console.log(JSON.stringify(message));
	// console.log(JSON.parse(message));
	// console.log(timerJobList.length);
}

function convertDayToNum(day){
	switch(day){
		case "Monday":
			return 1;
		case "Tuesday":
			return 2;
		case "Wednesday":
			return 3;
		case "Thursday":
			return 4;
		case "Friday":
			return 5;
		case "Saturday":
			return 6;
		case "Sunday":
			return 0;
	}
}

function stopAllJob(){
	for (let i = 0; i < timerJobList.length; i++){
		timerJobList[i].stop();
	}
	timerJobList = [];
}

function setUpForLog(date, deviceName, deviceId, room, time, action) {
 	firebase
    .database()
    .ref('/logList/' + date)
    .once('value')
    .then(function(snapshot){
    	let numChild = snapshot.numChildren();
    	let written = writeToLog(deviceName, deviceId, room, time, action, true, numChild);
		if(written) console.log("written to log");
    });
}

function writeToLog(deviceName, deviceId, room, time, action, autoControlled, numChild){
	let today = new Date();
  	let dd = today.getDate();
  	let mm = today.getMonth() + 1;
  	let yyyy = today.getFullYear();
  	let formattedDate = dd + '-' + mm + '-' + yyyy;

 	firebase
    .database()
    .ref('logList/' + formattedDate)
    .child(numChild)
    .set({
      action: action? 'off' : 'on',
      autoControlled: autoControlled,
      deviceID: deviceId,
      deviceName: deviceName,
      room: room,
      time: time,
    });
    return true;
}

function changeDeviceState(childIndex, room, value){
	firebase
	.database()
	.ref('deviceList/' + room)
	.child(childIndex)
	.child("deviceState")
	.set(value);
}

function updateDBAndPublish(JSONmessage){
	let messageFrom = JSON.parse(JSONmessage);
	console.log(messageFrom);
	let messageTo = [];
	for (let sensorData of messageFrom){
		let {device_id, values} = sensorData;
		// console.log(device_id);
		let room = deviceList[+device_id-1].room;
		let indexInRoom = deviceList[+device_id-1].indexInRoom;
		deviceListObj[room][indexInRoom].deviceState = values[0];

		if(values < 50){
			for (let obj of controlList){
				if (obj.sensorID == device_id){
					for (let lightID of obj.lightsID){
						let room = deviceList[lightID - 1].room;
						let indexInRoom = deviceList[lightID - 1].indexInRoom;
						deviceListObj[room][indexInRoom].deviceState = false;
						messageTo.push({device_id: lightID.toString(), values: ["0","255"]});
					}
				}
			}
		}
		else if(values > 230){
			for (let obj of controlList){
				if (obj.sensorID == device_id){
					for (let lightID of obj.lightsID){
						let room = deviceList[lightID - 1].room;
						let indexInRoom = deviceList[lightID - 1].indexInRoom;
						deviceListObj[room][indexInRoom].deviceState = true;
						messageTo.push({device_id: lightID.toString(), values: ["1","255"]});
					}
				}
			}
		}
	}

	client.publish("Topic/LightD",JSON.stringify(messageTo),{retain:false,qos:0});
	// console.log(deviceListObj);

	firebase
	.database()
	.ref('deviceList')
	.set(deviceListObj);

	let today = new Date();
  	let dd = today.getDate();
  	let mm = today.getMonth() + 1;
  	let yyyy = today.getFullYear();
  	let hh = today.getHours();
  	let min = today.getMinutes();
  	let time = hh + ':' + min;
  	let formattedDate = dd + '-' + mm + '-' + yyyy;
	firebase
	.database()
	.ref('logList' + formattedDate)
	.once('value')
	.then((snapshot)=>{
		let numChildCount = snapshot.numChildren();
		for (let i = 0; i < messageTo.length ; i++){
			let id = messageTo[i].device_id;
			let action = +messageTo[i].values[0];
			let device = deviceList[id - 1];
			writeToLog(device.deviceName, device.deviceID, device.room, time, !action, true, numChildCount + i);
		}
	})
}








 
 
