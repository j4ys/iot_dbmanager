import "babel-polyfill";
import { createApolloFetch } from "apollo-fetch";
import mqtt from "mqtt";

const mqttclient = mqtt.connect("mqtt://localhost", {
  clientId: "dbmanager"
});
let fetch;
let interval;
function startServer() {
  try {
    fetch = createApolloFetch({
	    uri: "http://localhost:4000/graphql"
    });
  } catch (err) {
    throw new Error("cannot connect to server");
    console.log("connecting to gql server failed");
  }
  fetch({
    query: "{ devices { location, device_id }}"
  })
    .then(res => {
	clearInterval(interval)
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
            const res7 = await mqttclient.subscribe(
              `/feeds/all/status` // /feeds/*/*/ctemp
            );
            console.log(res1.topic);
            console.log(res2.topic);
          } catch (err) {
		  throw new Error("error fetching devices");
            console.log(err);
          }
        });
      }
    })
    .catch(err => console.log("error fetching device"));
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
  } else if (pathvalues[3] === "status" && pathvalues[2] === "all") {
    fetch({
      query: `mutation syncalldeviceStatus($status: Boolean!){
        changeAllStatus(status:$status)
      }`,
      variables: { status: msg === "true" }
    }).then(res => {
      if (!res.data || !res) {
        return false;
      }
      return true;
    });
  } else if (pathvalues[1] === "feeds" && pathvalues[2] === "adddevice") {
    fetch({
      query: `query fetchDevice($device_id: String!) 
	   { device(device_id:$device_id )
		   { 
    			location
			device_id
   		    }
	   }`,
      variables: { device_id: msg }
    }).then(async res => {
      if (!res || !res.data) {
        return false;
      } else {
        console.log(res.data.device.location);
        const { device_id, location } = res.data.device;
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
      }
    });
  }
  console.log(`message ${msg}`);
});

	interval = setInterval(startServer, 2000);
//startServer();
