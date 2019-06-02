import { createApolloFetch } from "apollo-fetch";
import mqtt from "mqtt";

const fetch = createApolloFetch({
  uri: "http://localhost:4000/graphql"
});
const mqttclient = mqtt.connect("mqtt://192.168.31.188", {
  clientId: "dbmanager"
});
function startServer() {
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
            `/feeds/${device.location}/${device.device_id}/temp`
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
  msg = msg.toString();
  console.log(typeof msg);
  if (pathvalues[4] === "temp") {
    fetch({
      query: `mutation ChangeTemp($device_id: String!, $temp: Int!){
          changeTemp(device_id:$device_id, temp:$temp)
      }`,
      variables: { device_id: pathvalues[3], temp: Number(msg) }
    }).then(res => {
      console.log(res.data);
    });
  } else {
    fetch({
      query: `mutation Statusmutation($device_id: String!, $value: Boolean!) {
    changepower(device_id: $device_id, value: $value) 
  }`,
      variables: {
        device_id: pathvalues[3],
        value: msg === "true"
      }
    });
  }
  console.log(`message ${msg}`);
});

startServer();
