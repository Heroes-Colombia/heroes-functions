export async function sendDataToWompi(url: string, data: any) {
  const paymentResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer prv_test_OcvZmqJvYZb4RqoQM6yVVnxK9aKqKNCf",
    },
    body: JSON.stringify(data),
  });
  const newData = await paymentResponse.json();
  return newData;
}

export async function getDataFromWoompiWithParam(url: string, param: string) {
  const paymentResponse = await fetch(url + "/" + param, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer prv_test_OcvZmqJvYZb4RqoQM6yVVnxK9aKqKNCf",
    },
  });
  const newData = await paymentResponse.json();
  return newData;
}
