
const int JOY_X = 32;
const int JOY_Y = 33;
const int JOY_SW = 22;

void setup() {
  Serial.begin(115200);

  pinMode(JOY_SW, INPUT_PULLUP);
}

void loop() {
  int x = analogRead(JOY_X);
  int y = analogRead(JOY_Y);

  // Button press hone par LOW read hota hai
  bool button = (digitalRead(JOY_SW) == LOW);

  // JSON: browser isi format ko read karega
  Serial.print("{\"x\":");
  Serial.print(x);

  Serial.print(",\"y\":");
  Serial.print(y);

  Serial.print(",\"button\":");
  Serial.print(button ? "true" : "false");

  Serial.println("}");

  delay(20);  // approximately 50 readings per second
}