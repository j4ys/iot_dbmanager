import { createApolloFetch } from "apollo-fetch";
import mqtt from "mqtt";

const mqttclient = mqtt.connect("mqtt://192.168.1.2", {
  clientId: "dbmanager"
});
function startServer() {
  let fetch;
  try {
    fetch = createApolloFetch({
      uri: "http://localhost:4000/graphql"
    });
  } catch (err) {
    throw new Error("cannot connect to server");
    console.log(err);
  }
  fetch({
    query: "{ devices { location, device_id }}"
  }).then(res => {
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
          console.log(res1.topic);
          console.log(res2.topic);
        } catch (err) {
          console.log(err);
        }
      });
    }
  });
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
          changeTemp(device_id:$device_id, temp:$temp)
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
  }
  console.log(`message ${msg}`);
});

try {
  startServer();
} catch (err) {
  console.log(err);
}
