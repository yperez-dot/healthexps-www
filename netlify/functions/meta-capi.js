const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const PIXEL_ID = "2219926808840253";
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { event_name = "Lead", event_source_url, client_ip_address,
          client_user_agent, fbc, fbp, em, ph, fn, ln, zp, ct, st, country } = body;

  const eventData = {
    data: [{
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url,
      user_data: {
        client_ip_address,
        client_user_agent,
        ...(fbc && { fbc }),
        ...(fbp && { fbp }),
        ...(em  && { em }),
        ...(ph  && { ph }),
        ...(fn  && { fn }),
        ...(ln  && { ln }),
        ...(zp  && { zp }),
        ...(ct  && { ct }),
        ...(st  && { st }),
        ...(country && { country }),
      }
    }],
    test_event_code: process.env.META_TEST_CODE || undefined
  };

  const postData = JSON.stringify(eventData);
  const options = {
    hostname: "graph.facebook.com",
    path: `/v20.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "https://www.healthexps.com" },
          body: data
        });
      });
    });
    req.on("error", (e) => resolve({ statusCode: 500, body: e.message }));
    req.write(postData);
    req.end();
  });
};
