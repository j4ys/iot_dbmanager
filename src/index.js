import "babel-polyfill"
import { createApolloFetch } from "apollo-fetch";
import mqtt from "mqtt";

const mqttclient = mqtt.connect("mqtt://localhost", {
  clientId: "dbmanager"
});
let fetch;
function startServer() {
  try {
    fetch = createApolloFetch({
      uri: "https://embryozim.tech/graphql"
    });
  } catch (err) {
    throw new Error("cannot connect to server");
    console.log(err);
  }
  fetch({
    query: "{ devices { location, device_id }}"
  })
    .then(res => {
      console.log(res.data.devices);
      if (res.data) {
        const devices = res.data.devices;
        devices.map(async device => {
          try {
            const res1 = await mqttclient.subscribe(
              `/feeds/${device.location}/${device.device_id}/status`
            );
            const res2 = await mqttclient.subscribe(
              `/feeds/${device.location}/${device.device_id}/ctemp`
            );
            const res3 = await mqttclient.subscribe(
              `/feeds/${device.location}/${device.device_id}/human` // /feeds/*/*/ctemp
            );
            const res4 = await mqttclient.subscribe(
              `/feeds/${device.location}/${device.device_id}/temp` // /feeds/*/*/ctemp
            );
            const res5 = await mqttclient.subscribe(
              `/feeds/all/temp` // /feeds/*/*/ctemp
            );
		  const res6 = await mqttclient.subscribe(
              `/feeds/adddevice` // /feeds/*/*/ctemp
            );
            console.log(res1.topic);
            console.log(res2.topic);
          } catch (err) {
            console.log(err);
          }
        });
      }
    })
    .catch(err => console.log(err));
}

mqttclient.on("message", (topic, msg) => {
  console.log(`Topic ${topic}`);
  const pathvalues = topic.split("/");
  console.log(pathvalues);
  msg = msg.toString();
  console.log(typeof msg);
  if (pathvalues[4] === "ctemp") {
    fetch({
      query: `mutation ChangeTemp($device_id: String!, $temp: Int!){
          changeCTemp(device_id:$device_id, temp:$temp)
      }`,
      variables: { device_id: pathvalues[3], temp: Number(msg) }
    }).then(res => {
      console.log(res.data);
    });
  } else if (pathvalues[4] === "human") {
    console.log("human = " + typeof msg);
    fetch({
      query: `mutation ChangeHumanValue($device_id: String!, $value: Boolean!){
        humanpresence(device_id: $device_id, value: $value)
    }`,
      variables: { device_id: pathvalues[3], value: msg === "1" }
    }).then(res => {
      console.log(res);
    });
  } else if (pathvalues[4] === "status") {
    fetch({
      query: `mutation Swtitch($device_id: String!){
        changestatus(device_id:$device_id){
          name,
          device_id,
          location
        }
      }`,
      variables: { device_id: pathvalues[3] }
    }).then(res => {
      if (!res.data) {
        return false;
      }
      return true;
    });
  } else if (pathvalues[4] === "temp") {
    fetch({
      query: `mutation Temp($device_id: String!, $temp:Int!){
        changeTemp(device_id: $device_id, temp: $temp)
      }`,
      variables: { device_id: pathvalues[3], temp: Number(msg) }
    }).then(res => {
      console.log(res);
      if (!res.data) {
        return false;
      }
      return true;
    });
  } else if (pathvalues[3] === "temp" && pathvalues[2] === "all") {
    fetch({
      query: `mutation syncalldevice($temp: Int!){
        changeAllTemp(temp:$temp)
      }`,
      variables: { temp: Number(msg) }
    }).then(res => {
      if (!res.data) {
        return false;
      }
      return true;
    });
  } else if(pathvalues[1] === "feeds" && pathvalues[2] === "adddevice"){
   fetch({ 
	   query: `query fetchDevice($device_id: String!) 
	   { device(device_id:$device_id )
		   { 
    			location
			device_id
   		    }
	   }`,
	   variables: {device_id: msg }
   }).then(async res => { if(!res || !res.data) {  
	   return false; 
   } else {
   console.log(res.data.device.location);
	   const {device_id , location } = res.data.device;
const res1 = await mqttclient.subscribe(
              `/feeds/${location}/${device_id}/status`
            );
            const res2 = await mqttclient.subscribe(
              `/feeds/${location}/${device_id}/ctemp`
            );
            const res3 = await mqttclient.subscribe(
              `/feeds/${location}/${device_id}/human` // /feeds/*/*/ctemp
            );
            const res4 = await mqttclient.subscribe(
              `/feeds/${location}/${device_id}/temp` // /feeds/*/*/ctemp
            );
            const res5 = await mqttclient.subscribe(
              `/feeds/all/temp` // /feeds/*/*/ctemp
            );

   }   
   })
  }
  console.log(`message ${msg}`);
});

try {
  startServer();
} catch (err) {
  console.log(err);
}
